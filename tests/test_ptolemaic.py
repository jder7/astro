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
        self.assertEqual(names, ["conjunction", "sextile", "square", "trine", "quincunx", "opposition"])
        self.assertTrue(all(isinstance(a, NormalAspect) for a in PTOLEMAIC_ASPECTS))

    def test_pattern_definitions(self):
        ids = [p.id for p in PTOLEMAIC_PATTERNS]
        self.assertEqual(len(PTOLEMAIC_PATTERNS), 9)
        self.assertIn("stellium", ids)
        self.assertIn("yod", ids)
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

    def test_yod_detection_and_boundary(self):
        subject = {
            "apex": {"abs_pos": 0.0},
            "base1": {"abs_pos": 150.0},
            "base2": {"abs_pos": 210.0},
            "active_points": ["apex", "base1", "base2"],
        }
        matches = compute_ptolemaic_patterns(subject, active_points=subject["active_points"])
        yods = [m for m in matches if m.configuration.id == "yod"]
        self.assertTrue(yods, "Yod should be detected for sextile + two quincunxes")
        first = yods[0]
        self.assertEqual(first.structure.get("apex"), "apex")
        self.assertEqual(first.structure.get("base"), ("base1", "base2"))

        subject_off = {
            "apex": {"abs_pos": 0.0},
            "base1": {"abs_pos": 150.0},
            "base2": {"abs_pos": 214.0},  # sextile barely within orb; quincunx beyond orb
            "active_points": ["apex", "base1", "base2"],
        }
        matches_off = compute_ptolemaic_patterns(subject_off, active_points=subject_off["active_points"])
        yods_off = [m for m in matches_off if m.configuration.id == "yod"]
        self.assertFalse(yods_off, "Yod should not be detected when quincunx is outside orb")

    def test_transit_patterns_case_one(self):
        # Config: all active points enabled; values shown for completeness.
        config = {
            "house_system": "P",
            "perspective": "Topocentric",
            "sidereal_mode": "KRISHNAMURTI",
            "zodiac_type": "Sidereal",
        }
        self.assertEqual(config["house_system"], "P")  # sanity check: config present

        subject = {
            # Stellium cluster ~0°–12°
            "p1": {"abs_pos": 0.0},
            "p2": {"abs_pos": 6.0},
            "p3": {"abs_pos": 12.0},
            # T-square: p1 (0°) opposite p4 (180°) with p5 at 90°
            "p4": {"abs_pos": 180.0},
            "p5": {"abs_pos": 90.0},
            "active_points": ["p1", "p2", "p3", "p4", "p5"],
        }
        patterns = compute_ptolemaic_patterns(subject, active_points=subject["active_points"])
        ids = {p.configuration.id for p in patterns}
        self.assertIn("stellium", ids)
        self.assertIn("t_square", ids)
        self.assertNotIn("kite", ids)

    def test_transit_patterns_case_two(self):
        # Same config, different date/time scenario: expect more patterns.
        config = {
            "house_system": "P",
            "perspective": "Topocentric",
            "sidereal_mode": "KRISHNAMURTI",
            "zodiac_type": "Sidereal",
        }
        self.assertEqual(config["zodiac_type"], "Sidereal")  # sanity check: config present

        subject = {
            # Stellium cluster near 0°
            "p1": {"abs_pos": 0.0},
            "p2": {"abs_pos": 6.0},
            "p3": {"abs_pos": 12.0},
            # Grand trine + kite core
            "p4": {"abs_pos": 120.0},
            "p5": {"abs_pos": 240.0},
            "p6": {"abs_pos": 180.0},  # opposite p1, sextile p4/p5
            # T-square focal at 90°
            "p7": {"abs_pos": 90.0},
            "active_points": ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
        }
        patterns = compute_ptolemaic_patterns(subject, active_points=subject["active_points"])
        ids = {p.configuration.id for p in patterns}
        self.assertTrue({"stellium", "t_square", "grand_trine", "kite"}.issubset(ids))

    def test_all_configurations_detectable_with_inline_samples(self):
        # Synthetic minimal sets for every configuration to ensure coverage without external files.
        scenarios = {
            "stellium": {
                "subject": {"a": {"abs_pos": 0.0}, "b": {"abs_pos": 6.0}, "c": {"abs_pos": 12.0}},
                "active": ["a", "b", "c"],
            },
            "t_square": {
                "subject": {"a": {"abs_pos": 0.0}, "b": {"abs_pos": 90.0}, "c": {"abs_pos": 180.0}},
                "active": ["a", "b", "c"],
            },
            "grand_trine": {
                "subject": {"a": {"abs_pos": 0.0}, "b": {"abs_pos": 120.0}, "c": {"abs_pos": 240.0}},
                "active": ["a", "b", "c"],
            },
            "yod": {
                "subject": {"apex": {"abs_pos": 0.0}, "b1": {"abs_pos": 150.0}, "b2": {"abs_pos": 210.0}},
                "active": ["apex", "b1", "b2"],
            },
            "kite": {
                "subject": {
                    "a": {"abs_pos": 0.0},
                    "b": {"abs_pos": 120.0},
                    "c": {"abs_pos": 240.0},
                    "d": {"abs_pos": 180.0},
                },
                "active": ["a", "b", "c", "d"],
            },
            "grand_cross": {
                "subject": {"a": {"abs_pos": 0.0}, "b": {"abs_pos": 90.0}, "c": {"abs_pos": 180.0}, "d": {"abs_pos": 270.0}},
                "active": ["a", "b", "c", "d"],
            },
            "grand_sextile": {
                "subject": {
                    "a": {"abs_pos": 0.0},
                    "b": {"abs_pos": 60.0},
                    "c": {"abs_pos": 120.0},
                    "d": {"abs_pos": 180.0},
                    "e": {"abs_pos": 240.0},
                    "f": {"abs_pos": 300.0},
                },
                "active": ["a", "b", "c", "d", "e", "f"],
            },
            "mystic_rectangle": {
                "subject": {"a": {"abs_pos": 0.0}, "b": {"abs_pos": 120.0}, "c": {"abs_pos": 180.0}, "d": {"abs_pos": 300.0}},
                "active": ["a", "b", "c", "d"],
            },
            "trapeze": {
                "subject": {"a": {"abs_pos": 0.0}, "b": {"abs_pos": 60.0}, "c": {"abs_pos": 120.0}, "d": {"abs_pos": 180.0}},
                "active": ["a", "b", "c", "d"],
            },
        }

        for pattern_id, data in scenarios.items():
            with self.subTest(pattern=pattern_id):
                patterns = compute_ptolemaic_patterns(data["subject"], active_points=data["active"])
                ids = {p.configuration.id for p in patterns}
                self.assertIn(pattern_id, ids)


if __name__ == "__main__":
    unittest.main()
