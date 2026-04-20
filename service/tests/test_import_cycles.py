import unittest


class TestImportCycles(unittest.TestCase):
    def test_point_range_and_weekly_schedule_imports(self):
        from service.aspects.point_range import compute_point_sign_timeline  # noqa: F401
        from service.utils.weekly_ray_schedule import build_weekly_ray_schedule  # noqa: F401

        self.assertTrue(callable(compute_point_sign_timeline))
        self.assertTrue(callable(build_weekly_ray_schedule))


if __name__ == "__main__":
    unittest.main()
