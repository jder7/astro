import unittest

from kerykeion import AspectsFactory  # type: ignore

from service.schemas import BirthData, ChartConfig
from service.utils import build_subject, filter_aspects_model, _normalize_point_key


class TestAspectFiltering(unittest.TestCase):
    def setUp(self) -> None:
        self.birth = BirthData(
            name="Subject",
            year=1990,
            month=1,
            day=1,
            hour=12,
            minute=0,
            lng=0.0,
            lat=0.0,
            tz_str="UTC",
        )

    def _extract_points(self, entry) -> tuple[str, str]:
        left_keys = [
            "p1_name",
            "first_point",
            "inner_point",
            "planet_a",
            "point_a",
            "point1",
            "planet1",
            "body_a",
            "body1",
            "point_1",
            "p1_point",
            "left",
            "first",
            "inner",
            "p1",
        ]
        right_keys = [
            "p2_name",
            "second_point",
            "outer_point",
            "planet_b",
            "point_b",
            "point2",
            "planet2",
            "body_b",
            "body2",
            "point_2",
            "p2_point",
            "right",
            "second",
            "outer",
            "p2",
        ]

        def pick(keys):
            if isinstance(entry, dict):
                for key in keys:
                    val = entry.get(key)
                    if val:
                        return str(val)
            for key in keys:
                if hasattr(entry, key):
                    val = getattr(entry, key)
                    if val:
                        return str(val)
            return ""

        return pick(left_keys), pick(right_keys)

    def _entries_from_model(self, model):
        for field in ("aspects", "aspects_list", "dual_chart_aspects", "aspect_list"):
            val = getattr(model, field, None)
            if isinstance(val, list):
                return val
        return []

    def test_filters_model_aspects_by_active_points(self):
        cfg = ChartConfig(active_points=["sun", "moon"])
        subject = build_subject(self.birth, cfg)
        aspects_model = AspectsFactory.natal_aspects(subject)
        filtered = filter_aspects_model(aspects_model, cfg.active_points)
        allowed = {_normalize_point_key(p) for p in cfg.active_points}
        aspects = self._entries_from_model(filtered)
        self.assertIsInstance(aspects, list)
        for entry in aspects:
            left_raw, right_raw = self._extract_points(entry)
            left_key = _normalize_point_key(left_raw)
            right_key = _normalize_point_key(right_raw)
            self.assertIn(left_key, allowed)
            self.assertIn(right_key, allowed)

    def test_filters_dual_chart_aspects(self):
        cfg = ChartConfig(active_points=["sun", "moon", "ascendant"])
        subject_a = build_subject(self.birth, cfg)
        other = BirthData(
            name="Other",
            year=1995,
            month=6,
            day=15,
            hour=18,
            minute=30,
            lng=0.0,
            lat=0.0,
            tz_str="UTC",
        )
        subject_b = build_subject(other, cfg)
        aspects_model = AspectsFactory.dual_chart_aspects(subject_a, subject_b)
        filtered = filter_aspects_model(aspects_model, cfg.active_points)
        allowed = {_normalize_point_key(p) for p in cfg.active_points}
        aspects = self._entries_from_model(filtered)
        self.assertIsInstance(aspects, list)
        for entry in aspects:
            left_raw, right_raw = self._extract_points(entry)
            left_key = _normalize_point_key(left_raw)
            right_key = _normalize_point_key(right_raw)
            self.assertIn(left_key, allowed)
            self.assertIn(right_key, allowed)

    def test_excludes_mean_lilith_when_not_configured(self):
        cfg = ChartConfig(active_points=["sun", "moon", "ascendant"])
        subject = build_subject(self.birth, cfg)
        other = BirthData(
            name="Other",
            year=1992,
            month=2,
            day=2,
            hour=6,
            minute=15,
            lng=0.0,
            lat=0.0,
            tz_str="UTC",
        )
        other_subject = build_subject(other, cfg)
        aspects_model = AspectsFactory.dual_chart_aspects(subject, other_subject)
        filtered = filter_aspects_model(aspects_model, cfg.active_points)
        aspects = self._entries_from_model(filtered)
        for entry in aspects:
            left_raw, right_raw = self._extract_points(entry)
            self.assertNotEqual(_normalize_point_key(left_raw), "mean_lilith")
            self.assertNotEqual(_normalize_point_key(right_raw), "mean_lilith")

    def test_filters_p1_p2_name_structure(self):
        class DummyAspects:
            def __init__(self, aspects):
                self.aspects = aspects

        aspects_model = DummyAspects(
            [
                {"p1_name": "Sun", "p2_name": "Moon", "aspect": "conjunction"},
                {"p1_name": "Sun", "p2_name": "Mean Lilith", "aspect": "square"},
            ]
        )
        filtered = filter_aspects_model(aspects_model, ["sun", "moon"])
        aspects = self._entries_from_model(filtered)
        self.assertEqual(len(aspects), 1)
        left_raw, right_raw = self._extract_points(aspects[0])
        self.assertEqual(_normalize_point_key(left_raw), "sun")
        self.assertEqual(_normalize_point_key(right_raw), "moon")


if __name__ == "__main__":
    unittest.main()
