import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

from service.schemas import BirthData, ChartConfig
from service.aspects.point_range import compute_point_sign_range
from service.utils import build_subject_for_moment


class TestPointSignRange(unittest.TestCase):
    def setUp(self) -> None:
        self.birth = BirthData(
            name="Anchor",
            year=2020,
            month=1,
            day=1,
            hour=11,
            minute=11,
            lng=4.8952,
            lat=52.3702,
            tz_str="Europe/Amsterdam",
        )
        self.anchor = datetime(2020, 1, 1, 11, 11, tzinfo=ZoneInfo(self.birth.tz_str))
        self.cfg = ChartConfig()

    def test_point_range_sun_matches_anchor_sign(self):
        result = compute_point_sign_range(self.birth, self.cfg, self.anchor, point_key="sun", identifier="test")
        entries = result.entries
        self.assertGreaterEqual(len(entries), 12)

        anchor_subject = build_subject_for_moment(self.birth, self.anchor, self.cfg)
        anchor_sign = anchor_subject.model_dump(mode="json").get("sun", {}).get("sign")
        self.assertEqual(entries[0].sign, anchor_sign)
        self.assertLessEqual(entries[0].start, self.anchor)
        self.assertGreater(entries[0].end, self.anchor)

    def test_point_range_has_ordered_entries(self):
        result = compute_point_sign_range(self.birth, self.cfg, self.anchor, point_key="mars", identifier="test")
        entries = result.entries
        self.assertGreaterEqual(len(entries), 12)
        for entry in entries:
            self.assertLess(entry.start, entry.end)
            self.assertEqual(entry.start.second, 0)
            self.assertEqual(entry.start.microsecond, 0)
            self.assertEqual(entry.end.second, 0)
            self.assertEqual(entry.end.microsecond, 0)
            self.assertTrue(entry.sign)

    def test_point_range_moon_includes_phase_and_illumination(self):
        result = compute_point_sign_range(self.birth, self.cfg, self.anchor, point_key="moon", identifier="test")
        entries = result.entries
        self.assertTrue(entries, "Expected moon range entries.")

        phases = [e.phase for e in entries if e.phase]
        emojis = [e.phase_emoji for e in entries if e.phase_emoji]
        illuminations = [e.illumination_percentage for e in entries if e.illumination_percentage is not None]

        self.assertTrue(phases, "Expected at least one lunar phase name.")
        self.assertTrue(emojis, "Expected at least one lunar phase emoji.")
        self.assertTrue(illuminations, "Expected at least one illumination percentage.")

        for value in illuminations:
            self.assertIsInstance(value, (int, float))
            self.assertGreaterEqual(value, 0.0)
            self.assertLessEqual(value, 100.0)
        self.assertIsNotNone(result.next_lunation, "Expected next_lunation for moon point range.")

    def test_point_range_ascendant_and_sun(self):
        asc = compute_point_sign_range(self.birth, self.cfg, self.anchor, point_key="ascendant", identifier="test")
        sun = compute_point_sign_range(self.birth, self.cfg, self.anchor, point_key="sun", identifier="test")
        self.assertTrue(asc.entries, "Expected ascendant entries.")
        self.assertTrue(sun.entries, "Expected sun entries.")


if __name__ == "__main__":
    unittest.main()
