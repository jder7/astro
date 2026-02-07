import unittest

from pydantic import ValidationError

from service.schemas import BirthData


class TestBirthDataValidation(unittest.TestCase):
    def test_latitude_boundaries(self):
        BirthData(lat=90.0, lng=0.0)  # should be allowed
        BirthData(lat=-90.0, lng=0.0)  # should be allowed

    def test_latitude_out_of_range_raises(self):
        with self.assertRaises(ValidationError):
            BirthData(lat=90.1, lng=0.0)
        with self.assertRaises(ValidationError):
            BirthData(lat=-90.1, lng=0.0)

    def test_longitude_boundaries(self):
        BirthData(lat=0.0, lng=180.0)  # should be allowed
        BirthData(lat=0.0, lng=-180.0)  # should be allowed

    def test_longitude_out_of_range_raises(self):
        with self.assertRaises(ValidationError):
            BirthData(lat=0.0, lng=180.0001)
        with self.assertRaises(ValidationError):
            BirthData(lat=0.0, lng=-180.0001)


if __name__ == "__main__":
    unittest.main()
