import asyncio
import unittest

from service.endpoints.transit import transit_snapshot
from service.schemas import BirthData, TransitMomentInput, TransitMomentRequest


class TestTransitSynastry(unittest.TestCase):
    def setUp(self) -> None:
        self.moment = TransitMomentInput(
            year=2024,
            month=1,
            day=1,
            hour=12,
            minute=0,
            lng=0.0,
            lat=0.0,
            tz_str="UTC",
        )

    def test_synastry_included_with_birth(self):
        birth = BirthData(
            name="Natal",
            year=1990,
            month=1,
            day=1,
            hour=12,
            minute=0,
            lng=0.0,
            lat=0.0,
            tz_str="UTC",
        )
        payload = TransitMomentRequest(moment=self.moment, birth=birth)
        response = asyncio.run(transit_snapshot(payload))
        self.assertIsNotNone(response.snapshot.synastry)
        self.assertIsInstance(response.snapshot.synastry, dict)
        self.assertIn("aspects", response.snapshot.synastry)
        self.assertIsInstance(response.snapshot.synastry_major_aspects, list)
        self.assertIsNotNone(response.snapshot.house_projections)
        self.assertTrue(hasattr(response.snapshot.house_projections, "transit_into_natal"))
        self.assertEqual(
            set(response.snapshot.house_projections.transit_into_natal.houses.keys()),
            set(range(1, 13)),
        )
        if response.snapshot.synastry_major_aspects:
            first = response.snapshot.synastry_major_aspects[0]
            self.assertIsInstance(first.point_owners, list)

    def test_synastry_none_without_birth(self):
        payload = TransitMomentRequest(moment=self.moment, birth=None)
        response = asyncio.run(transit_snapshot(payload))
        self.assertIsNone(response.snapshot.synastry)
        self.assertEqual(response.snapshot.synastry_major_aspects, [])
        self.assertIsNone(response.snapshot.house_projections)


if __name__ == "__main__":
    unittest.main()
