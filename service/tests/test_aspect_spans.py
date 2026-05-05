import asyncio
import unittest
from datetime import timedelta

from service.aspects.timeline_spans import (
    ASPECT_ANGLES,
    DEFAULT_ORBS,
    _moving_active_points_for_range,
    angular_difference,
    compute_orb_for_aspect,
    compute_range_aspect_spans,
)
from service.aspects.timeline_spans_kinematic import compute_kinematic_range_aspect_spans
from service.endpoints.aspect_spans import aspect_spans, aspect_spans_kinematic
from service.schemas import BirthData, ChartConfig
from service.utils.config import ensure_config
from service.utils.ranges import to_local_datetime


class TestAspectMath(unittest.TestCase):
    def test_angular_difference_wraps(self):
        self.assertAlmostEqual(angular_difference(350, 10), 20)
        self.assertAlmostEqual(angular_difference(0, 180), 180)

    def test_orb_for_aspect(self):
        self.assertAlmostEqual(compute_orb_for_aspect(100, 100, ASPECT_ANGLES["conjunction"]), 0)
        self.assertAlmostEqual(compute_orb_for_aspect(10, 97, ASPECT_ANGLES["square"]), 3)


class TestRangeAspectSpans(unittest.TestCase):
    def setUp(self):
        self.base = BirthData(
            name="Transit",
            year=2025,
            month=6,
            day=15,
            hour=12,
            minute=0,
            lng=4.8952,
            lat=52.3702,
            tz_str="Europe/Amsterdam",
        )
        self.birth = BirthData(
            name="Natal",
            year=1990,
            month=1,
            day=1,
            hour=12,
            minute=0,
            lng=4.8952,
            lat=52.3702,
            tz_str="Europe/Amsterdam",
        )
        self.cfg = ensure_config(ChartConfig(active_points=["sun", "moon", "mercury", "venus", "mars"]))
        self.start_dt = to_local_datetime(self.base)
        self.end_dt = self.start_dt.replace(day=17)

    def test_range_response_shape(self):
        result = compute_range_aspect_spans(self.base, self.cfg, self.start_dt, self.end_dt, mode="transit")
        self.assertIn("spans", result)
        self.assertIn("candidate_pairs", result)
        self.assertGreater(result["candidate_pairs"], 0)
        self.assertIsInstance(result["spans"], list)
        if result["spans"]:
            span = result["spans"][0]
            required = {
                "id",
                "left",
                "right",
                "leftSign",
                "rightSign",
                "aspect",
                "startAt",
                "exactAt",
                "endAt",
                "minOrb",
                "confidence",
                "samples",
            }
            self.assertTrue(required.issubset(span.keys()), f"Missing keys: {required - set(span)}")
            self.assertLessEqual(span["startAt"], span["exactAt"])
            self.assertLessEqual(span["exactAt"], span["endAt"])

    def test_natal_transit_owner_ids(self):
        result = compute_range_aspect_spans(
            self.base,
            self.cfg,
            self.start_dt,
            self.end_dt,
            mode="natal_transit",
            birth=self.birth,
        )
        self.assertEqual(result["mode"], "natal_transit")
        if result["spans"]:
            span = result["spans"][0]
            self.assertEqual(span["leftOwner"], "Natal")
            self.assertEqual(span["rightOwner"], "Transit")
            self.assertIn("Natal:", span["id"])
            self.assertIn(":Transit:", span["id"])

    def test_active_span_returns_full_lifecycle_outside_requested_window(self):
        base = BirthData(
            name="Transit",
            year=2026,
            month=2,
            day=5,
            hour=12,
            minute=0,
            lng=4.8952,
            lat=52.3702,
            tz_str="Europe/Amsterdam",
        )
        end = BirthData(
            name="End",
            year=2026,
            month=2,
            day=6,
            hour=12,
            minute=0,
            lng=4.8952,
            lat=52.3702,
            tz_str="Europe/Amsterdam",
        )
        cfg = ensure_config(ChartConfig(active_points=["venus", "uranus"]))
        start_dt = to_local_datetime(base)
        end_dt = to_local_datetime(end)
        result = compute_range_aspect_spans(base, cfg, start_dt, end_dt, mode="transit")
        square_spans = [span for span in result["spans"] if span["aspect"] == "square"]
        self.assertEqual(len(square_spans), 1)
        span = square_spans[0]
        self.assertLess(span["startAt"], start_dt.isoformat())
        self.assertGreater(span["endAt"], end_dt.isoformat())
        self.assertEqual(span["confidence"], "full")

    def test_range_point_pruning_keeps_large_presets_manageable(self):
        points = ["ascendant", "medium_coeli", "moon", "mercury", "venus", "mars", "jupiter"]
        one_day = _moving_active_points_for_range(points, self.start_dt, self.start_dt + timedelta(days=1))
        one_month = _moving_active_points_for_range(points, self.start_dt, self.start_dt + timedelta(days=30))
        three_months = _moving_active_points_for_range(points, self.start_dt, self.start_dt + timedelta(days=90))
        one_year = _moving_active_points_for_range(points, self.start_dt, self.start_dt + timedelta(days=365))

        self.assertIn("ascendant", one_day)
        self.assertIn("moon", one_day)
        self.assertNotIn("ascendant", one_month)
        self.assertNotIn("medium_coeli", one_month)
        self.assertNotIn("moon", one_month)
        self.assertNotIn("moon", three_months)
        self.assertIn("mercury", one_month)
        self.assertIn("venus", one_month)
        self.assertNotIn("mercury", one_year)
        self.assertNotIn("venus", one_year)
        self.assertIn("mars", one_year)
        self.assertIn("jupiter", one_year)

    def test_kinematic_outer_planet_series_appends_exact_passes(self):
        base = BirthData(
            name="Transit",
            year=2026,
            month=1,
            day=1,
            hour=12,
            minute=0,
            lng=4.8952,
            lat=52.3702,
            tz_str="Europe/Amsterdam",
        )
        cfg = ensure_config(ChartConfig(active_points=["uranus", "pluto"]))
        start_dt = to_local_datetime(base)
        result = compute_kinematic_range_aspect_spans(
            base,
            cfg,
            start_dt,
            start_dt + timedelta(days=1100),
            mode="transit",
        )
        trines = [span for span in result["spans"] if span["aspect"] == "trine"]
        self.assertEqual(len(trines), 1)
        span = trines[0]
        self.assertEqual(span.get("seriesCount"), 5)
        self.assertEqual(len(span.get("passes", [])), 5)
        exact_dates = [item["exactAt"][:10] for item in span["passes"]]
        self.assertEqual(
            exact_dates,
            ["2026-07-18", "2026-11-29", "2027-06-15", "2028-01-13", "2028-05-10"],
        )
        self.assertLessEqual(span["startAt"], span["passes"][0]["startAt"])
        self.assertGreaterEqual(span["endAt"], span["passes"][-1]["endAt"])

    def test_kinematic_spans_include_passes_array(self):
        cfg = ensure_config(ChartConfig(active_points=["sun", "moon", "mercury"]))
        result = compute_kinematic_range_aspect_spans(
            self.base,
            cfg,
            self.start_dt,
            self.start_dt + timedelta(days=1),
            mode="transit",
        )
        self.assertGreater(result["spans_count"], 0)
        for span in result["spans"]:
            self.assertIn("passes", span)
            self.assertEqual(span.get("seriesCount"), len(span["passes"]))
            self.assertGreaterEqual(len(span["passes"]), 1)
            self.assertEqual(span["passes"][0]["seriesId"], span["seriesId"])

    def test_kinematic_fast_point_repeats_do_not_collapse_into_pass_series(self):
        cfg = ensure_config(ChartConfig(active_points=["ascendant", "neptune"]))
        result = compute_kinematic_range_aspect_spans(
            self.base,
            cfg,
            self.start_dt,
            self.start_dt + timedelta(days=1),
            mode="transit",
        )
        self.assertGreater(result["spans_count"], 0)
        for span in result["spans"]:
            self.assertEqual(span.get("seriesCount"), 1)
            self.assertEqual(len(span.get("passes", [])), 1)

    def test_kinematic_ref_20260425_ascendant_square_neptune_is_single_pass(self):
        base = BirthData(
            name="Transit",
            year=2026,
            month=4,
            day=25,
            hour=9,
            minute=20,
            lng=4.8952,
            lat=52.3702,
            tz_str="Europe/Amsterdam",
        )
        cfg = ensure_config(ChartConfig(active_points=["ascendant", "neptune"]))
        start_dt = to_local_datetime(base)
        result = compute_kinematic_range_aspect_spans(
            base,
            cfg,
            start_dt,
            start_dt + timedelta(days=1),
            mode="transit",
        )
        square_spans = [
            span
            for span in result["spans"]
            if span["left"] == "Ascendant" and span["right"] == "Neptune" and span["aspect"] == "square"
        ]
        self.assertGreaterEqual(len(square_spans), 1)
        self.assertTrue(any(span["startAt"] <= start_dt.isoformat() <= span["endAt"] for span in square_spans))
        for span in square_spans:
            self.assertEqual(span.get("seriesCount"), 1)
            self.assertEqual(len(span.get("passes", [])), 1)

    def test_kinematic_ref_20260425_mercury_chiron_square_has_valid_boundaries(self):
        base = BirthData(
            name="Transit",
            year=2026,
            month=4,
            day=25,
            hour=9,
            minute=20,
            lng=26.1025,
            lat=44.4268,
            tz_str="Europe/Bucharest",
        )
        cfg = ensure_config(ChartConfig(active_points=["mercury", "chiron"]))
        reference_dt = to_local_datetime(base)
        result = compute_kinematic_range_aspect_spans(
            base,
            cfg,
            reference_dt - timedelta(days=180),
            reference_dt + timedelta(days=180),
            mode="transit",
        )
        square_spans = [
            span
            for span in result["spans"]
            if span["left"] == "Mercury" and span["right"] == "Chiron" and span["aspect"] == "square"
        ]
        self.assertGreaterEqual(len(square_spans), 1)
        sag_pis_spans = [span for span in square_spans if span["leftSign"] == "Sag" and span["rightSign"] == "Pis"]
        self.assertEqual(len(sag_pis_spans), 1)
        self.assertTrue(sag_pis_spans[0]["exactAt"].startswith("2026-01-16"))

        for span in square_spans:
            self.assertLessEqual(span["startAt"], span["exactAt"])
            self.assertLessEqual(span["exactAt"], span["endAt"])
            self.assertIsNotNone(span["minOrb"])
            self.assertLessEqual(span["minOrb"], DEFAULT_ORBS["square"])


class TestAspectSpansEndpoint(unittest.TestCase):
    def test_endpoint_accepts_range_payload(self):
        payload = {
            "mode": "transit",
            "moment": {
                "year": 2025,
                "month": 6,
                "day": 15,
                "hour": 12,
                "minute": 0,
                "lng": 4.8952,
                "lat": 52.3702,
                "tz_str": "Europe/Amsterdam",
            },
            "end": {"year": 2025, "month": 6, "day": 16, "hour": 12, "minute": 0},
            "config": {"active_points": ["sun", "moon", "mercury"]},
        }
        result = asyncio.run(aspect_spans(payload))
        self.assertEqual(result["mode"], "transit")
        self.assertIn("start", result)
        self.assertIn("end", result)
        self.assertIn("spans_count", result)
        self.assertIn("timestamps_evaluated", result)
        self.assertIsInstance(result["spans"], list)

    def test_kinematic_endpoint_accepts_range_payload(self):
        payload = {
            "mode": "transit",
            "moment": {
                "year": 2025,
                "month": 6,
                "day": 15,
                "hour": 12,
                "minute": 0,
                "lng": 4.8952,
                "lat": 52.3702,
                "tz_str": "Europe/Amsterdam",
            },
            "end": {"year": 2025, "month": 6, "day": 16, "hour": 12, "minute": 0},
            "config": {"active_points": ["sun", "moon", "mercury"]},
        }
        result = asyncio.run(aspect_spans_kinematic(payload))
        self.assertEqual(result["mode"], "transit")
        self.assertEqual(result["engine"], "kinematic")
        self.assertIn("start", result)
        self.assertIn("end", result)
        self.assertIn("spans_count", result)
        self.assertIn("timestamps_evaluated", result)
        self.assertIsInstance(result["spans"], list)

    def test_endpoint_accepts_natal_transit_payload(self):
        payload = {
            "mode": "natal_transit",
            "moment": {
                "year": 2025,
                "month": 6,
                "day": 15,
                "hour": 12,
                "minute": 0,
                "lng": 4.8952,
                "lat": 52.3702,
                "tz_str": "Europe/Amsterdam",
            },
            "end": {"year": 2025, "month": 6, "day": 16, "hour": 12, "minute": 0},
            "birth": {
                "name": "Natal",
                "year": 1990,
                "month": 1,
                "day": 1,
                "hour": 12,
                "minute": 0,
                "lng": 4.8952,
                "lat": 52.3702,
                "tz_str": "Europe/Amsterdam",
            },
            "config": {"active_points": ["sun", "moon", "mercury"]},
        }
        result = asyncio.run(aspect_spans(payload))
        self.assertEqual(result["mode"], "natal_transit")
        self.assertIsInstance(result["spans"], list)

    def test_endpoint_handles_dst_nonexistent_start_time(self):
        payload = {
            "mode": "transit",
            "moment": {
                "year": 2025,
                "month": 3,
                "day": 30,
                "hour": 2,
                "minute": 30,
                "lng": 4.8952,
                "lat": 52.3702,
                "tz_str": "Europe/Amsterdam",
            },
            "end": {"year": 2025, "month": 3, "day": 30, "hour": 4, "minute": 30},
            "config": {"active_points": ["sun", "moon", "mercury"]},
        }
        result = asyncio.run(aspect_spans(payload))
        self.assertEqual(result["mode"], "transit")
        self.assertIsInstance(result["spans"], list)


if __name__ == "__main__":
    unittest.main()
