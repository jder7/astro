import unittest

from service.utils import compute_synastry_major_aspects


class TestSynastryMajorAspects(unittest.TestCase):
    def test_cross_owner_patterns_include_owner_metadata(self):
        first = {
            "sun": {"abs_pos": 0.0},
            "moon": {"abs_pos": 180.0},
        }
        second = {
            "mars": {"abs_pos": 90.0},
            "venus": {"abs_pos": 270.0},
        }
        patterns = compute_synastry_major_aspects(first, second, ["sun", "moon", "mars", "venus"])
        self.assertTrue(patterns, "Expected cross-owner major patterns.")

        for pattern in patterns:
            points = pattern.get("points") or []
            point_owners = pattern.get("point_owners") or []
            self.assertEqual(len(points), len(point_owners))
            self.assertIn("1", point_owners)
            self.assertIn("2", point_owners)

            for link in pattern.get("links") or []:
                pair = link.get("pair") or []
                pair_owners = link.get("pair_owners") or []
                self.assertEqual(len(pair), len(pair_owners))

    def test_filters_to_active_points(self):
        first = {
            "sun": {"abs_pos": 0.0},
            "moon": {"abs_pos": 180.0},
            "mars": {"abs_pos": 210.0},
        }
        second = {
            "sun": {"abs_pos": 90.0},
            "moon": {"abs_pos": 270.0},
            "venus": {"abs_pos": 300.0},
        }
        active = ["sun", "moon"]
        patterns = compute_synastry_major_aspects(first, second, active)
        for pattern in patterns:
            for point in pattern.get("points") or []:
                self.assertIn(point, active)

    def test_excludes_single_owner_only_patterns(self):
        first = {
            "sun": {"abs_pos": 0.0},
            "moon": {"abs_pos": 120.0},
            "mars": {"abs_pos": 240.0},
        }
        second = {
            "venus": {"abs_pos": 13.0},
        }
        patterns = compute_synastry_major_aspects(first, second, ["sun", "moon", "mars", "venus"])
        self.assertEqual(patterns, [], "Single-owner-only patterns should be discarded.")


if __name__ == "__main__":
    unittest.main()
