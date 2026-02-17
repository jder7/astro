import asyncio
import unittest

from service.endpoints.relationship import relationship
from service.schemas import BirthData, RelationshipRequest


class TestRelationshipResponse(unittest.TestCase):
    def test_response_excludes_ranges(self):
        first = BirthData(year=1990, month=1, day=1, hour=12, minute=0, lng=0.0, lat=0.0, tz_str="UTC")
        second = BirthData(year=1995, month=6, day=15, hour=18, minute=30, lng=0.0, lat=0.0, tz_str="UTC")
        payload = RelationshipRequest(first=first, second=second)
        response = asyncio.run(relationship(payload))
        data = response.model_dump()
        self.assertNotIn("point_sign_range", data)
        self.assertIsInstance(response.aspects, list)
        self.assertIsInstance(response.synastry_major_aspects, list)
        self.assertIsNotNone(response.house_projections)
        self.assertEqual(set(response.house_projections.first_into_second.houses.keys()), set(range(1, 13)))
        self.assertEqual(set(response.house_projections.second_into_first.houses.keys()), set(range(1, 13)))
        if response.synastry_major_aspects:
            first_pattern = response.synastry_major_aspects[0]
            self.assertIsInstance(first_pattern.point_owners, list)


if __name__ == "__main__":
    unittest.main()
