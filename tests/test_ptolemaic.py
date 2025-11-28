import unittest

from aspects.ptolemaic import (
    PTOLEMAIC_ASPECTS,
    PTOLEMAIC_PATTERNS,
    NormalAspect,
    PtolemaicAspectCalculator,
    PtolemaicAspectConfiguration,
    compute_major_aspects,
    compute_ptolemaic_patterns,
)


class TestPtolemaicDefinitions(unittest.TestCase):
    def test_aspect_definitions(self):
        names = [a.name for a in PTOLEMAIC_ASPECTS]
        self.assertEqual(names, ["conjunction", "sextile", "square", "trine", "opposition"])
        self.assertTrue(all(isinstance(a, NormalAspect) for a in PTOLEMAIC_ASPECTS))

    def test_pattern_definitions(self):
        ids = [p.id for p in PTOLEMAIC_PATTERNS]
        self.assertEqual(len(PTOLEMAIC_PATTERNS), 7)
        self.assertIn("stellium", ids)
        self.assertTrue(all(isinstance(p, PtolemaicAspectConfiguration) for p in PTOLEMAIC_PATTERNS))


class TestPtolemaicAspectCalculator(unittest.TestCase):
    def test_custom_calculator_instance(self):
        # Basic sanity: compute_patterns returns even when no pattern matches.
        subject = {"sun": {"abs_pos": 0.0}, "moon": {"abs_pos": 5.0}, "active_points": ["sun", "moon"]}
        calc = PtolemaicAspectCalculator()
        aspects = calc.compute_patterns(subject, active_points=subject["active_points"])
        self.assertIsInstance(aspects, list)


class TestPtolemaicPatterns(unittest.TestCase):
    def setUp(self) -> None:
        # Hexagon at 0,60,120,180,240,300 plus squares at 90/270 for a grand cross and t-square.
        self.subject = {
            "p1": {"abs_pos": 0.0},
            "p2": {"abs_pos": 60.0},
            "p3": {"abs_pos": 120.0},
            "p4": {"abs_pos": 180.0},
            "p5": {"abs_pos": 240.0},
            "p6": {"abs_pos": 300.0},
            "p7": {"abs_pos": 90.0},
            "p8": {"abs_pos": 270.0},
        }
        self.active = list(self.subject.keys())

    def test_grand_trine_and_cross_and_sextile_detected(self):
        matches = compute_ptolemaic_patterns(self.subject, active_points=self.active)
        ids = {m.configuration.id for m in matches}
        self.assertIn("grand_trine", ids)
        self.assertIn("grand_cross", ids)
        self.assertIn("grand_sextile", ids)

        sextiles = [m for m in matches if m.configuration.id == "grand_sextile"]
        self.assertTrue(sextiles, "Expected at least one grand sextile match")
        triples = sextiles[0].structure.get("triples")
        self.assertIsInstance(triples, tuple)
        self.assertEqual(len(triples), 2)

    def test_t_square_detected(self):
        matches = compute_ptolemaic_patterns(self.subject, active_points=self.active)
        ids = {m.configuration.id for m in matches}
        self.assertIn("t_square", ids)

    def test_serialization(self):
        payload = compute_major_aspects(self.subject, active_points=self.active)
        self.assertTrue(payload)
        first = payload[0]
        self.assertIn("id", first)
        self.assertIn("links", first)
        self.assertIsInstance(first["links"], list)


if __name__ == "__main__":
    unittest.main()
