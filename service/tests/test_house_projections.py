import unittest

from service.utils.house_projections import HouseProjectionEngine


def _houses_equal_30(start=0.0):
    out = {}
    for idx in range(1, 13):
        out[f"house_{idx}"] = {"abs_pos": (start + (idx - 1) * 30.0) % 360.0}
    return out


class TestHouseProjections(unittest.TestCase):
    def setUp(self):
        self.engine = HouseProjectionEngine()

    def test_assigns_planets_to_expected_house(self):
        target = _houses_equal_30(0.0)
        source = {
            "sun": {"abs_pos": 0.0},
            "moon": {"abs_pos": 59.9},
            "mars": {"abs_pos": 120.0},
        }
        projected = self.engine.project(source, target, ["sun", "moon", "mars"])
        self.assertEqual(projected.houses[1], ["sun"])
        self.assertEqual(projected.houses[2], ["moon"])
        self.assertEqual(projected.houses[5], ["mars"])

    def test_handles_cusp_boundaries_and_wrap(self):
        target = _houses_equal_30(350.0)
        source = {
            "sun": {"abs_pos": 359.0},
            "moon": {"abs_pos": 5.0},
            "mars": {"abs_pos": 20.0},
            "venus": {"abs_pos": 349.0},
        }
        projected = self.engine.project(source, target, ["sun", "moon", "mars", "venus"])
        self.assertEqual(projected.houses[1], ["sun", "moon"])
        self.assertEqual(projected.houses[2], ["mars"])
        self.assertEqual(projected.houses[12], ["venus"])

    def test_filters_to_planets_even_if_non_planets_are_active(self):
        target = _houses_equal_30(0.0)
        source = {
            "sun": {"abs_pos": 10.0},
            "moon": {"abs_pos": 15.0},
            "ascendant": {"abs_pos": 20.0},
            "true_north_lunar_node": {"abs_pos": 25.0},
        }
        projected = self.engine.project(
            source,
            target,
            ["sun", "moon", "ascendant", "true_north_lunar_node"],
        )
        self.assertEqual(projected.houses[1], ["sun", "moon"])

    def test_preserves_active_points_order_inside_house(self):
        target = _houses_equal_30(0.0)
        source = {
            "sun": {"abs_pos": 5.0},
            "moon": {"abs_pos": 10.0},
            "mars": {"abs_pos": 20.0},
        }
        projected = self.engine.project(source, target, ["mars", "sun", "moon"])
        self.assertEqual(projected.houses[1], ["mars", "sun", "moon"])

    def test_build_transit_projection_shape(self):
        transit = {"sun": {"abs_pos": 5.0}}
        natal = _houses_equal_30(0.0)
        response = self.engine.build_transit_response(transit, natal, ["sun"])
        self.assertTrue(hasattr(response, "transit_into_natal"))
        self.assertEqual(set(response.transit_into_natal.houses.keys()), set(range(1, 13)))

    def test_build_relationship_projection_shape(self):
        first = {"sun": {"abs_pos": 5.0}}
        second = {"moon": {"abs_pos": 35.0}}
        first.update(_houses_equal_30(0.0))
        second.update(_houses_equal_30(0.0))
        response = self.engine.build_relationship_response(first, second, ["sun", "moon"])
        self.assertTrue(hasattr(response, "first_into_second"))
        self.assertTrue(hasattr(response, "second_into_first"))
        self.assertEqual(set(response.first_into_second.houses.keys()), set(range(1, 13)))
        self.assertEqual(set(response.second_into_first.houses.keys()), set(range(1, 13)))


if __name__ == "__main__":
    unittest.main()
