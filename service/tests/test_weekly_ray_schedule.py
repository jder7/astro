import unittest
from datetime import timedelta
from unittest.mock import patch

from service.schemas import TransitMomentInput, WeeklyRayScheduleRequest, WeeklyScheduleSegment
from service.utils.weekly_ray_schedule import build_weekly_ray_schedule, render_weekly_schedule_pdf


def _segment(
    start,
    end,
    ratio,
    *,
    point_key="sun",
    label="Segment",
    sign="Aries",
    sign_icon="♈︎",
    element="Fire",
    color="#ef4444",
):
    return WeeklyScheduleSegment(
        start=start,
        end=end,
        ratio=ratio,
        point_key=point_key,
        label=label,
        sign=sign,
        sign_icon=sign_icon,
        element=element,
        color=color,
        ray_colors=[color],
    )


class TestWeeklyRaySchedule(unittest.TestCase):
    def setUp(self):
        self.payload = WeeklyRayScheduleRequest(
            mode="transit",
            moment=TransitMomentInput(
                year=2025,
                month=3,
                day=12,
                hour=14,
                minute=0,
                lng=4.8952,
                lat=52.3702,
                tz_str="Europe/Amsterdam",
            ),
        )

    @patch("service.utils.weekly_ray_schedule._compute_day_ruler_segments_for_day")
    @patch("service.utils.weekly_ray_schedule._compute_point_segments")
    def test_day_without_split(self, mock_point_segments, mock_day_segments):
        def point_side_effect(**kwargs):
            return [
                _segment(
                    kwargs["start"],
                    kwargs["end"],
                    1.0,
                    point_key=kwargs["point_key"],
                    label=kwargs["point_key"],
                    sign="Aries",
                    element="Fire",
                    color="#ef4444",
                )
            ]

        def day_side_effect(**kwargs):
            seg = _segment(
                kwargs["day_start"],
                kwargs["day_end"],
                1.0,
                point_key=kwargs["ruler_key"],
                label="Day ruler",
                sign="Leo",
                element="Fire",
                color="#fb923c",
            )
            aura = seg.model_copy(update={"label": "Day aura"})
            return [seg], [aura]

        mock_point_segments.side_effect = point_side_effect
        mock_day_segments.side_effect = day_side_effect

        response = build_weekly_ray_schedule(self.payload)
        self.assertEqual(len(response.days), 7)
        self.assertTrue(all(not day.has_ruler_split for day in response.days))
        self.assertTrue(all(len(day.ruler_segments) == 1 for day in response.days))
        noon_cell = next(row for row in response.rows if row.hour == 12).cells[0]
        self.assertFalse(noon_cell.has_element_sigil, "Sigil must remain hidden when all four elements are not present.")

    @patch("service.utils.weekly_ray_schedule._compute_day_ruler_segments_for_day")
    @patch("service.utils.weekly_ray_schedule._compute_point_segments")
    def test_day_split_and_hour_crossing_transition(self, mock_point_segments, mock_day_segments):
        def point_side_effect(**kwargs):
            point_key = kwargs["point_key"]
            color = "#ef4444" if point_key != "moon" else "#1e3a8a"
            element = "Fire" if point_key != "moon" else "Water"
            sign = "Aries" if point_key != "moon" else "Cancer"
            return [
                _segment(
                    kwargs["start"],
                    kwargs["end"],
                    1.0,
                    point_key=point_key,
                    label=point_key,
                    sign=sign,
                    element=element,
                    color=color,
                )
            ]

        def day_side_effect(**kwargs):
            day_start = kwargs["day_start"]
            day_end = kwargs["day_end"]
            ruler_key = kwargs["ruler_key"]
            if day_start.weekday() == 0:
                split_at = day_start.replace(hour=11, minute=30)
                seg1 = _segment(
                    day_start,
                    split_at,
                    11.5 / 24.0,
                    point_key=ruler_key,
                    label="Day ruler",
                    sign="Virgo",
                    element="Earth",
                    color="#eab308",
                )
                seg2 = _segment(
                    split_at,
                    day_end,
                    12.5 / 24.0,
                    point_key=ruler_key,
                    label="Day ruler",
                    sign="Libra",
                    element="Air",
                    color="#22c55e",
                )
                return [seg1, seg2], [seg1.model_copy(update={"label": "Day aura"}), seg2.model_copy(update={"label": "Day aura"})]

            seg = _segment(
                day_start,
                day_end,
                1.0,
                point_key=ruler_key,
                label="Day ruler",
                sign="Virgo",
                element="Earth",
                color="#eab308",
            )
            return [seg], [seg.model_copy(update={"label": "Day aura"})]

        mock_point_segments.side_effect = point_side_effect
        mock_day_segments.side_effect = day_side_effect

        response = build_weekly_ray_schedule(self.payload)
        monday = response.days[0]
        self.assertTrue(monday.has_ruler_split)
        self.assertGreaterEqual(len(monday.ruler_segments), 2)
        self.assertAlmostEqual(sum(segment.ratio for segment in monday.ruler_segments), 1.0, places=6)

        hour_11 = next(row for row in response.rows if row.hour == 11)
        monday_cell = hour_11.cells[0]
        self.assertEqual(len(monday_cell.day_ruler_segment), 2)

    @patch("service.utils.weekly_ray_schedule._compute_day_ruler_segments_for_day")
    @patch("service.utils.weekly_ray_schedule._compute_point_segments")
    def test_pdf_render_returns_bytes(self, mock_point_segments, mock_day_segments):
        def point_side_effect(**kwargs):
            return [
                _segment(
                    kwargs["start"],
                    kwargs["end"],
                    1.0,
                    point_key=kwargs["point_key"],
                    label=kwargs["point_key"],
                    sign="Aries",
                    element="Fire",
                    color="#ef4444",
                )
            ]

        def day_side_effect(**kwargs):
            seg = _segment(
                kwargs["day_start"],
                kwargs["day_end"],
                1.0,
                point_key=kwargs["ruler_key"],
                label="Day ruler",
                sign="Leo",
                element="Fire",
                color="#fb923c",
            )
            return [seg], [seg.model_copy(update={"label": "Day aura"})]

        mock_point_segments.side_effect = point_side_effect
        mock_day_segments.side_effect = day_side_effect

        schedule = build_weekly_ray_schedule(self.payload)
        pdf = render_weekly_schedule_pdf(schedule, hour_start=6, hour_end=20)
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertGreater(len(pdf), 1500)

    @patch("service.utils.weekly_ray_schedule._compute_day_ruler_segments_for_day")
    @patch("service.utils.weekly_ray_schedule._compute_point_segments")
    def test_sigil_hidden_when_minor_split_adds_missing_element(self, mock_point_segments, mock_day_segments):
        def point_side_effect(**kwargs):
            start = kwargs["start"]
            end = kwargs["end"]
            point_key = kwargs["point_key"]
            if point_key == "sun":
                return [
                    _segment(
                        start,
                        end,
                        1.0,
                        point_key=point_key,
                        label=point_key,
                        sign="Aries",
                        element="Fire",
                        color="#ef4444",
                    )
                ]
            if point_key == "moon":
                return [
                    _segment(
                        start,
                        end,
                        1.0,
                        point_key=point_key,
                        label=point_key,
                        sign="Pisces",
                        element="Water",
                        color="#1e3a8a",
                    )
                ]
            if point_key == "ascendant":
                split_at = start + timedelta(minutes=10)
                return [
                    _segment(
                        start,
                        split_at,
                        10.0 / 60.0,
                        point_key=point_key,
                        label=point_key,
                        sign="Gemini",
                        element="Air",
                        color="#22c55e",
                    ),
                    _segment(
                        split_at,
                        end,
                        50.0 / 60.0,
                        point_key=point_key,
                        label=point_key,
                        sign="Taurus",
                        element="Earth",
                        color="#eab308",
                    ),
                ]
            return []

        def day_side_effect(**kwargs):
            seg = _segment(
                kwargs["day_start"],
                kwargs["day_end"],
                1.0,
                point_key=kwargs["ruler_key"],
                label="Day ruler",
                sign="Pisces",
                element="Water",
                color="#1e3a8a",
            )
            return [seg], [seg.model_copy(update={"label": "Day aura"})]

        mock_point_segments.side_effect = point_side_effect
        mock_day_segments.side_effect = day_side_effect

        response = build_weekly_ray_schedule(self.payload)
        first_hour_first_day = next(row for row in response.rows if row.hour == 0).cells[0]
        self.assertFalse(
            first_hour_first_day.has_element_sigil,
            "Sigil must remain hidden when Fire/Water/Water/Earth are dominant components.",
        )


if __name__ == "__main__":
    unittest.main()
