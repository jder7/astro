import unittest
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from schemas import BirthData, ChartConfig
from aspects.sun_range import compute_sun_year_range
from utils import build_subject_for_moment


class TestSunYearRange(unittest.TestCase):
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

    def test_range_covers_year_signs(self):
        result = compute_sun_year_range(self.birth, self.cfg, self.anchor, "test", label="Test")
        entries = result.entries
        self.assertGreaterEqual(len(entries), 12)
        # Compact sample output for visibility when running the suite.
        preview = [
            {
                "start": entries[0].start.isoformat(),
                "end": entries[0].end.isoformat(),
                "sign": entries[0].sign,
            },
            {
                "start": entries[1].start.isoformat(),
                "end": entries[1].end.isoformat(),
                "sign": entries[1].sign,
            },
            {
                "start": entries[-1].start.isoformat(),
                "end": entries[-1].end.isoformat(),
                "sign": entries[-1].sign,
            },
        ]
        print("Sun year range sample:", preview)

        anchor_subject = build_subject_for_moment(self.birth, self.anchor, self.cfg)
        anchor_sign = anchor_subject.model_dump(mode="json").get("sun", {}).get("sign")
        self.assertEqual(entries[0].sign, anchor_sign)
        self.assertIn(anchor_sign, self.zodiac_order)

        start_idx = self.zodiac_order.index(anchor_sign)
        expected = [self.zodiac_order[(start_idx + i) % 12] for i in range(12)]
        self.assertEqual([e.sign for e in entries[:12]], expected)

        self.assertLessEqual(entries[0].start, self.anchor)
        self.assertGreater(entries[0].end, self.anchor)

        span = entries[-1].end - entries[0].start
        self.assertGreaterEqual(span, timedelta(days=330))
        self.assertLessEqual(span, timedelta(days=410))

        for i, entry in enumerate(entries):
            self.assertLess(entry.start, entry.end)
            self.assertEqual(entry.start.second, 0)
            self.assertEqual(entry.start.microsecond, 0)
            self.assertEqual(entry.end.second, 0)
            self.assertEqual(entry.end.microsecond, 0)
            if i < len(entries) - 1:
                self.assertLessEqual(entry.end, entries[i + 1].start)

    def test_signs_progress_forward(self):
        result = compute_sun_year_range(self.birth, self.cfg, self.anchor, "forward", label="Forward")
        entries = result.entries
        order_indices = [self.zodiac_order.index(e.sign) for e in entries if e.sign in self.zodiac_order]
        for prev, curr in zip(order_indices, order_indices[1:]):
            self.assertEqual(curr, (prev + 1) % 12)


if __name__ == "__main__":
    unittest.main()
