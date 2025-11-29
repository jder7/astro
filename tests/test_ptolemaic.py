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
        self.assertEqual(len(PTOLEMAIC_PATTERNS), 8)
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
        self.assertIn("kite", ids)

        sextiles = [m for m in matches if m.configuration.id == "grand_sextile"]
        self.assertTrue(sextiles, "Expected at least one grand sextile match")
        triples = sextiles[0].structure.get("triples")
        self.assertIsInstance(triples, tuple)
        self.assertEqual(len(triples), 2)

    def test_t_square_detected(self):
        matches = compute_ptolemaic_patterns(self.subject, active_points=self.active)
        ids = {m.configuration.id for m in matches}
        self.assertIn("t_square", ids)

    def test_kite_boundary_positive(self):
        # A kite right at orb edges should still match.
        subject = {
            "a": {"abs_pos": 0.0},
            "b": {"abs_pos": 124.0},   # trine to A within orb (delta 4)
            "c": {"abs_pos": 244.0},   # trine to A within orb (delta 4)
            "d": {"abs_pos": 184.0},   # opposition to A delta 4; sextile to B/C delta 4
            "active_points": ["a", "b", "c", "d"],
        }
        matches = compute_ptolemaic_patterns(subject, active_points=subject["active_points"])
        kite = [m for m in matches if m.configuration.id == "kite"]
        self.assertTrue(kite, "Kite should be detected at orb boundary")

    def test_kite_boundary_negative(self):
        # Move D just beyond sextile/opposition orb so kite should disappear.
        subject = {
            "a": {"abs_pos": 0.0},
            "b": {"abs_pos": 124.0},
            "c": {"abs_pos": 244.0},
            "d": {"abs_pos": 188.2},  # beyond sextile/opposition orbs
            "active_points": ["a", "b", "c", "d"],
        }
        matches = compute_ptolemaic_patterns(subject, active_points=subject["active_points"])
        kite = [m for m in matches if m.configuration.id == "kite"]
        self.assertFalse(kite, "Kite should not be detected when outside orbs")

    def test_serialization(self):
        payload = compute_major_aspects(self.subject, active_points=self.active)
        self.assertTrue(payload)
        first = payload[0]
        self.assertIn("id", first)
        self.assertIn("links", first)
        self.assertIsInstance(first["links"], list)

    def test_stellium_boundary(self):
        subject = {
            "p1": {"abs_pos": 0.0},
            "p2": {"abs_pos": 4.0},
            "p3": {"abs_pos": 6.0},
            "p4": {"abs_pos": 50.0},  # outside 30° window
            "active_points": ["p1", "p2", "p3", "p4"],
        }
        matches = compute_ptolemaic_patterns(subject, active_points=subject["active_points"])
        ids = {m.configuration.id for m in matches}
        self.assertIn("stellium", ids)

        subject_far = {
            "p1": {"abs_pos": 0.0},
            "p2": {"abs_pos": 40.0},
            "p3": {"abs_pos": 80.0},
            "active_points": ["p1", "p2", "p3"],
        }
        matches = compute_ptolemaic_patterns(subject_far, active_points=subject_far["active_points"])
        ids = {m.configuration.id for m in matches}
        self.assertNotIn("stellium", ids)

    def test_t_square_boundary(self):
        subject = {
            "a": {"abs_pos": 0.0},
            "b": {"abs_pos": 180.0},
            "c": {"abs_pos": 90.0},
            "active_points": ["a", "b", "c"],
        }
        ids = {m.configuration.id for m in compute_ptolemaic_patterns(subject, active_points=subject["active_points"])}
        self.assertIn("t_square", ids)

        subject_off = {
            "a": {"abs_pos": 0.0},
            "b": {"abs_pos": 180.0},
            "c": {"abs_pos": 100.0},  # square delta 10 > 6
            "active_points": ["a", "b", "c"],
        }
        ids = {m.configuration.id for m in compute_ptolemaic_patterns(subject_off, active_points=subject_off["active_points"])}
        self.assertNotIn("t_square", ids)

    def test_grand_trine_boundary(self):
        subject = {
            "a": {"abs_pos": 0.0},
            "b": {"abs_pos": 120.0},
            "c": {"abs_pos": 240.0},
            "active_points": ["a", "b", "c"],
        }
        ids = {m.configuration.id for m in compute_ptolemaic_patterns(subject, active_points=subject["active_points"])}
        self.assertIn("grand_trine", ids)

        subject_off = {
            "a": {"abs_pos": 0.0},
            "b": {"abs_pos": 120.0},
            "c": {"abs_pos": 247.0},  # trine delta 7 > 6 to a
            "active_points": ["a", "b", "c"],
        }
        ids = {m.configuration.id for m in compute_ptolemaic_patterns(subject_off, active_points=subject_off["active_points"])}
        self.assertNotIn("grand_trine", ids)

    def test_grand_cross_boundary(self):
        subject = {
            "a": {"abs_pos": 0.0},
            "b": {"abs_pos": 90.0},
            "c": {"abs_pos": 180.0},
            "d": {"abs_pos": 270.0},
            "active_points": ["a", "b", "c", "d"],
        }
        ids = {m.configuration.id for m in compute_ptolemaic_patterns(subject, active_points=subject["active_points"])}
        self.assertIn("grand_cross", ids)

        subject_off = {
            "a": {"abs_pos": 0.0},
            "b": {"abs_pos": 100.0},  # breaks opposition/square axis
            "c": {"abs_pos": 180.0},
            "d": {"abs_pos": 270.0},
            "active_points": ["a", "b", "c", "d"],
        }
        ids = {m.configuration.id for m in compute_ptolemaic_patterns(subject_off, active_points=subject_off["active_points"])}
        self.assertNotIn("grand_cross", ids)

    def test_grand_sextile_boundary(self):
        subject = {
            "p1": {"abs_pos": 0.0},
            "p2": {"abs_pos": 60.0},
            "p3": {"abs_pos": 120.0},
            "p4": {"abs_pos": 180.0},
            "p5": {"abs_pos": 240.0},
            "p6": {"abs_pos": 300.0},
            "active_points": ["p1", "p2", "p3", "p4", "p5", "p6"],
        }
        ids = {m.configuration.id for m in compute_ptolemaic_patterns(subject, active_points=subject["active_points"])}
        self.assertIn("grand_sextile", ids)

        subject_off = dict(subject)
        subject_off = {**subject, "p6": {"abs_pos": 305.5}, "active_points": list(subject["active_points"])}
        ids = {m.configuration.id for m in compute_ptolemaic_patterns(subject_off, active_points=subject_off["active_points"])}
        self.assertNotIn("grand_sextile", ids)

    def test_mystic_rectangle_boundary(self):
        subject = {
            "a": {"abs_pos": 0.0},
            "b": {"abs_pos": 120.0},
            "c": {"abs_pos": 180.0},
            "d": {"abs_pos": 300.0},
            "active_points": ["a", "b", "c", "d"],
        }
        ids = {m.configuration.id for m in compute_ptolemaic_patterns(subject, active_points=subject["active_points"])}
        self.assertIn("mystic_rectangle", ids)

        subject_off = {
            "a": {"abs_pos": 0.0},
            "b": {"abs_pos": 120.0},
            "c": {"abs_pos": 180.0},
            "d": {"abs_pos": 307.0},  # breaks trine/sextile
            "active_points": ["a", "b", "c", "d"],
        }
        ids = {m.configuration.id for m in compute_ptolemaic_patterns(subject_off, active_points=subject_off["active_points"])}
        self.assertNotIn("mystic_rectangle", ids)

    def test_trapeze_boundary(self):
        subject = {
            "a": {"abs_pos": 0.0},
            "b": {"abs_pos": 60.0},
            "c": {"abs_pos": 120.0},
            "d": {"abs_pos": 180.0},
            "active_points": ["a", "b", "c", "d"],
        }
        ids = {m.configuration.id for m in compute_ptolemaic_patterns(subject, active_points=subject["active_points"])}
        self.assertIn("trapeze", ids)

        subject_off = {
            "a": {"abs_pos": 0.0},
            "b": {"abs_pos": 60.0},
            "c": {"abs_pos": 120.0},
            "d": {"abs_pos": 187.0},  # opposition delta 7 > 6
            "active_points": ["a", "b", "c", "d"],
        }
        ids = {m.configuration.id for m in compute_ptolemaic_patterns(subject_off, active_points=subject_off["active_points"])}
        self.assertNotIn("trapeze", ids)

    def test_sample_transit_patterns(self):
        import json
        from pathlib import Path

        sample = json.loads(Path("samples/transit-result.json").read_text())
        config = json.loads(Path("samples/transit-config-input.json").read_text())
        subject = sample["snapshot"]["subject"]
        active = config.get("active_points", [])
        patterns = compute_ptolemaic_patterns(subject, active_points=active)
        ids = {p.configuration.id for p in patterns}
        self.assertIn("kite", ids, "Sample transit should include a kite pattern")

        kite_targets = [
            p for p in patterns if p.configuration.id == "kite" and set(p.points) == {"uranus", "saturn", "venus", "jupiter"}
        ]
        self.assertTrue(kite_targets, "Expected a kite spanning Uranus-Saturn-Venus-Jupiter")
        kite_pairs = {tuple(sorted(link.pair)) for link in kite_targets[0].links if link.type == "opposition"}
        self.assertTrue(
            any(set(pair) == {"uranus", "venus"} or set(pair) == {"uranus", "jupiter"} for pair in kite_pairs),
            "Kite should include an opposition involving Uranus",
        )

        stellia = [p for p in patterns if p.configuration.id == "stellium"]
        self.assertTrue(stellia, "Sample transit should include stellia")
        def link_pairs(stellium):
            return {tuple(sorted(link.pair)) for link in stellium.links}

        cluster_links = [
            p
            for p in stellia
            if set(p.points) >= {"mercury", "sun", "venus"}
            and ("mercury", "venus") in link_pairs(p)
            and ("sun", "venus") in link_pairs(p)
        ]
        self.assertTrue(cluster_links, "Mercury/Sun/Venus stellium should expose both conjunction links")


if __name__ == "__main__":
    unittest.main()
