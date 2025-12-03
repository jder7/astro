import unittest
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from schemas import BirthData, ChartConfig
from aspects.ascendant_range import compute_ascendant_day_range
from utils import build_subject_for_moment


class TestAscendantDayRange(unittest.TestCase):
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

    def test_range_covers_full_day_signs(self):
        result = compute_ascendant_day_range(self.birth, self.cfg, self.anchor, "test", label="Test")
        entries = result.entries
        self.assertGreaterEqual(len(entries), 12)

        anchor_subject = build_subject_for_moment(self.birth, self.anchor, self.cfg)
        anchor_sign = anchor_subject.model_dump(mode="json").get("ascendant", {}).get("sign")
        self.assertEqual(entries[0].sign, anchor_sign)
        self.assertIn(anchor_sign, self.zodiac_order)

        start_idx = self.zodiac_order.index(anchor_sign)
        expected = [self.zodiac_order[(start_idx + i) % 12] for i in range(12)]
        self.assertEqual([e.sign for e in entries[:12]], expected)

        self.assertLessEqual(entries[0].timestamp, self.anchor)
        self.assertGreater(entries[0].end, self.anchor)
        self.assertGreaterEqual(entries[-1].end, self.anchor + timedelta(hours=24))

        for i, entry in enumerate(entries):
            self.assertLess(entry.timestamp, entry.end)
            self.assertEqual(entry.timestamp.second, 0)
            self.assertEqual(entry.end.second, 0)
            if i < len(entries) - 1:
                self.assertLessEqual(entry.end, entries[i + 1].timestamp)
