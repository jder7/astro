import unittest
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from schemas import BirthData, ChartConfig, NextLunation
from aspects.moon_range import compute_moon_month_range
from utils import build_subject_for_moment


class TestMoonMonthRange(unittest.TestCase):
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
        self.zodiac_order = ["Ari", "Tau", "Gem", "Can", "Leo", "Vir", "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis"]

    def test_range_covers_month_signs(self):
        result = compute_moon_month_range(self.birth, self.cfg, self.anchor, "test", label="Test")
        entries = result.entries
        self.assertGreaterEqual(len(entries), 10)

        anchor_subject = build_subject_for_moment(self.birth, self.anchor, self.cfg)
        anchor_sign = anchor_subject.model_dump(mode="json").get("moon", {}).get("sign")
        self.assertEqual(entries[0].sign, anchor_sign)
        self.assertIn(anchor_sign, self.zodiac_order)

        for i in range(1, min(len(entries), 12)):
            prev_idx = self.zodiac_order.index(entries[i - 1].sign)
            curr_idx = self.zodiac_order.index(entries[i].sign)
            self.assertEqual(curr_idx, (prev_idx + 1) % 12)

        self.assertLessEqual(entries[0].start, self.anchor)
        self.assertGreater(entries[0].end, self.anchor)
        self.assertGreaterEqual(entries[-1].end, self.anchor + timedelta(days=27))

        for i, entry in enumerate(entries):
            self.assertLess(entry.start, entry.end)
            self.assertEqual(entry.start.second, 0)
            self.assertEqual(entry.end.second, 0)
            if i < len(entries) - 1:
                self.assertLessEqual(entry.end, entries[i + 1].start)

    def test_signs_are_strictly_progressive(self):
        result = compute_moon_month_range(self.birth, self.cfg, self.anchor, "progressive", label="Progressive")
        entries = result.entries
        self.assertTrue(entries, "Expected moon range entries.")

        # Ensure start times are sorted and sign does not repeat in adjacent entries.
        starts = [e.start for e in entries]
        self.assertEqual(starts, sorted(starts))
        for prev, curr in zip(entries, entries[1:]):
            self.assertNotEqual(prev.sign, curr.sign, "Adjacent entries must represent a sign change.")
            self.assertLessEqual(prev.end, curr.start)

        # The sequence should follow zodiac order (wrapping) for at least a full cycle.
        seen_order = [self.zodiac_order.index(e.sign) for e in entries if e.sign in self.zodiac_order]
        for i in range(1, min(len(seen_order), 12)):
            self.assertEqual(seen_order[i], (seen_order[i - 1] + 1) % 12)

    def test_range_metadata_and_length(self):
        result = compute_moon_month_range(self.birth, self.cfg, self.anchor, "natal-moon", label="Natal Moon")
        self.assertEqual(result.id, "natal-moon")
        self.assertEqual(result.label, "Natal Moon")
        self.assertIsNotNone(result.anchor)
        self.assertGreaterEqual(len(result.entries), 10)

        # Coverage should span close to a month (~27 days already asserted above; here ensure <40 days to avoid runaway).
        span = result.entries[-1].end - result.entries[0].start
        self.assertGreaterEqual(span, timedelta(days=25))
        self.assertLessEqual(span, timedelta(days=40))

    def test_entries_are_minute_precision(self):
        result = compute_moon_month_range(self.birth, self.cfg, self.anchor, "precision", label="Precision")
        self.assertTrue(result.entries, "Expected entries for minute precision check.")
        for entry in result.entries:
            self.assertEqual(entry.start.second, 0)
            self.assertEqual(entry.start.microsecond, 0)
            self.assertEqual(entry.end.second, 0)
            self.assertEqual(entry.end.microsecond, 0)

    def test_next_lunation_present_and_ordered(self):
        result = compute_moon_month_range(self.birth, self.cfg, self.anchor, "lunation", label="Lunation")
        self.assertIsNotNone(result.next_lunation, "Expected next_lunation on MoonMonthRange.")
        self.assertIsInstance(result.next_lunation, NextLunation)
        ts = result.next_lunation.timestamp
        self.assertIsInstance(ts, datetime)
        self.assertGreater(ts, self.anchor)
        # Should arrive within a month from anchor.
        self.assertLessEqual(ts - self.anchor, timedelta(days=35))
        # Minute precision
        self.assertEqual(ts.second, 0)
        self.assertEqual(ts.microsecond, 0)
