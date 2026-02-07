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


if __name__ == "__main__":
    unittest.main()
