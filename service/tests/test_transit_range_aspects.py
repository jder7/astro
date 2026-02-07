import asyncio
import unittest

from service.schemas import (
    BirthData,
    TransitEndInput,
    TransitMomentInput,
    TransitRangeRequest,
)
from service.endpoints.transit_range import transit_range


class TestTransitRangeAspects(unittest.TestCase):
    def setUp(self) -> None:
        self.moment = TransitMomentInput(year=2024, month=1, day=1, hour=12, minute=0, lng=0.0, lat=0.0, tz_str="UTC")
        self.end = TransitEndInput(year=2024, month=1, day=1, hour=12, minute=0)

    def test_aspects_default_to_disabled(self):
        payload = TransitRangeRequest(
            moment=self.moment,
            end=self.end,
            include_aspects=False,
        )
        response = asyncio.run(transit_range(payload))
        self.assertTrue(response.snapshots, "Expected at least one snapshot in transit range response.")
        snap = response.snapshots[0]
        self.assertEqual(snap.aspects, [])
        self.assertEqual(snap.major_aspects, [])

    def test_aspects_can_be_enabled(self):
        moment = TransitMomentInput(
            year=2025,
            month=11,
            day=27,
            hour=12,
            minute=0,
            lng=4.8952,
            lat=52.3702,
            tz_str="Europe/Amsterdam",
        )
        end = TransitEndInput(year=2025, month=11, day=27, hour=12, minute=0)
        natal = BirthData(
            name="Subject",
            year=1990,
            month=7,
            day=15,
            hour=10,
            minute=30,
            lng=4.8952,
            lat=52.3702,
            tz_str="Europe/Amsterdam",
        )
        payload = TransitRangeRequest(
            moment=moment,
            end=end,
            include_aspects=True,
            birth=natal,
            config={
                "active_points": [
                    "sun",
                    "moon",
                    "mercury",
                    "venus",
                    "mars",
                    "jupiter",
                    "saturn",
                    "uranus",
                    "neptune",
                    "pluto",
                    "ascendant",
                ]
            },
        )
        response = asyncio.run(transit_range(payload))
        self.assertTrue(response.snapshots, "Expected at least one snapshot in transit range response.")
        snap = response.snapshots[0]
        # print("transit-range aspects count:", len(snap.aspects))
        # print("transit-range aspects sample:", snap.aspects[:3])
        self.assertIsInstance(snap.aspects, list)
        self.assertIsInstance(snap.major_aspects, list)
        self.assertNotEqual(snap.aspects, [], "Aspects should be computed when include_aspects is true.")


if __name__ == "__main__":
    unittest.main()
