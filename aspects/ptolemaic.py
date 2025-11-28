from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations
from typing import Iterable, Optional, Sequence


@dataclass(frozen=True)
class NormalAspect:
    name: str
    angle: float
    orb: float
    icon: str


@dataclass(frozen=True)
class PtolemaicAspectConfiguration:
    id: str
    name: str
    planets: str
    aspects: tuple[str, ...]
    aspects_label: str
    geometry: str
    orb: str
    construction: str


@dataclass(frozen=True)
class AspectLink:
    """
    Minimal edge between two points with aspect metadata.
    """

    type: str
    pair: tuple[str, str]
    orb: float
    difference: float

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "pair": list(self.pair),
            "orb": self.orb,
            "difference": self.difference,
        }


@dataclass(frozen=True)
class PtolemaicAspect:
    """
    Concrete pattern match for a Ptolemaic configuration.
    """

    configuration: PtolemaicAspectConfiguration
    points: tuple[str, ...]
    links: tuple[AspectLink, ...]
    structure: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        cfg = self.configuration
        return {
            "id": cfg.id,
            "name": cfg.name,
            "planets": cfg.planets,
            "aspects": list(cfg.aspects),
            "aspects_label": cfg.aspects_label,
            "geometry": cfg.geometry,
            "orb": cfg.orb,
            "construction": cfg.construction,
            "points": list(self.points),
            "links": [link.to_dict() for link in self.links],
            "structure": self.structure or {},
        }


PTOLEMAIC_ASPECTS: tuple[NormalAspect, ...] = (
    NormalAspect("conjunction", 0.0, 6.0, "◎"),
    NormalAspect("sextile", 60.0, 4.0, "✺"),
    NormalAspect("square", 90.0, 6.0, "□"),
    NormalAspect("trine", 120.0, 6.0, "△"),
    NormalAspect("opposition", 180.0, 6.0, "☍"),
)


PTOLEMAIC_PATTERNS: tuple[PtolemaicAspectConfiguration, ...] = (
    PtolemaicAspectConfiguration(
        id="stellium",
        name="Stellium",
        planets="3+ planets",
        aspects=("conjunction",),
        aspects_label="Conjunctions",
        geometry="Clustered within ~30° (often one sign) with overlapping 0° links.",
        orb="Planets within ~5–10° of each other across the cluster.",
        construction="Conjunction-series bundle occupying one tight sector.",
    ),
    PtolemaicAspectConfiguration(
        id="t_square",
        name="T-Square",
        planets="3 planets",
        aspects=("opposition", "square"),
        aspects_label="Opposition + Squares",
        geometry="Opposition capped by two 90° squares, forming a T spine.",
        orb="Squares/opposition typically ±8–10°.",
        construction="A ↔ B opposition with C square to both (C = focal).",
    ),
    PtolemaicAspectConfiguration(
        id="grand_trine",
        name="Grand Trine",
        planets="3 planets",
        aspects=("trine",),
        aspects_label="Trines",
        geometry="Three 120° links in an equilateral triangle.",
        orb="Trines usually ±6–8° (often ~±7°).",
        construction="A–B–C all 120° apart forming a closed triangle.",
    ),
    PtolemaicAspectConfiguration(
        id="grand_cross",
        name="Grand Cross",
        planets="4 planets",
        aspects=("opposition", "square"),
        aspects_label="Oppositions + Squares",
        geometry="Four points every 90°: two oppositions plus four squares.",
        orb="Squares/oppositions typically ±8–10°.",
        construction="A↔C and B↔D oppositions; each is square to its neighbors.",
    ),
    PtolemaicAspectConfiguration(
        id="grand_sextile",
        name="Grand Sextile",
        planets="6 planets",
        aspects=("sextile", "trine"),
        aspects_label="Sextiles + Trines",
        geometry="Hexagram/Star of David: alternating 60° and 120° points.",
        orb="Sextiles ±5–6°; trines ±6–8°.",
        construction="Two interlaced Grand Trines linked by six sextiles.",
    ),
    PtolemaicAspectConfiguration(
        id="mystic_rectangle",
        name="Mystic Rectangle",
        planets="4 planets",
        aspects=("opposition", "trine", "sextile"),
        aspects_label="Oppositions, Trines, Sextiles",
        geometry="Two oppositions stitched by trines and sextiles into a rectangle.",
        orb="Oppositions ±8–10°; trines 6–8°; sextiles 5–6°.",
        construction="A↔C and B↔D; A sextile D & trine B, C sextile B & trine D.",
    ),
    PtolemaicAspectConfiguration(
        id="trapeze",
        name="Trapeze / Cradle",
        planets="4 planets",
        aspects=("opposition", "sextile"),
        aspects_label="Opposition + Sextiles",
        geometry="Three sextiles in a row with an opposition across the open ends.",
        orb="Sextiles ±5–6°; opposition ±8–10°.",
        construction="A sextile B sextile C sextile D, with A↔D in opposition.",
    ),
)


class PtolemaicAspectCalculator:
    """
    Compute the five major Ptolemaic aspects (0/60/90/120/180).
    """

    def __init__(self, aspects: Optional[Sequence[NormalAspect]] = None) -> None:
        self.aspects = tuple(aspects or PTOLEMAIC_ASPECTS)

    @staticmethod
    def _normalize_key(key: str) -> str:
        return str(key).replace(" ", "_").replace("-", "_").lower()

    def _extract_points(self, subject_data: dict) -> dict[str, dict]:
        points: dict[str, dict] = {}
        for raw_key, data in (subject_data or {}).items():
            if not isinstance(data, dict):
                continue
            abs_pos = data.get("abs_pos")
            try:
                abs_pos_val = float(abs_pos)
            except (TypeError, ValueError):
                continue
            norm_key = self._normalize_key(raw_key)
            points[norm_key] = dict(data, abs_pos=abs_pos_val)
        return points

    def _resolve_keys(self, points: dict[str, dict], active_points: Optional[Iterable[str]]) -> list[str]:
        keys: list[str] = []
        for pt in active_points or []:
            norm = self._normalize_key(pt)
            if norm in points and norm not in keys:
                keys.append(norm)
        if not keys:
            keys = sorted(points.keys())
        return keys

    @staticmethod
    def _angular_diff(a: float, b: float) -> float:
        diff_raw = abs(a - b) % 360.0
        return 360.0 - diff_raw if diff_raw > 180.0 else diff_raw

    def _classify(self, diff: float) -> tuple[Optional[NormalAspect], Optional[float]]:
        for aspect in self.aspects:
            delta = abs(diff - aspect.angle)
            if delta <= aspect.orb:
                return aspect, delta
        return None, None

    def _pair_aspects(self, points: dict[str, dict], keys: list[str]) -> dict[tuple[str, str], dict]:
        aspects: dict[tuple[str, str], dict] = {}
        for i, a in enumerate(keys):
            a_pos = points[a]["abs_pos"]
            for b in keys[i + 1 :]:
                b_pos = points[b]["abs_pos"]
                diff = self._angular_diff(float(a_pos), float(b_pos))
                aspect_def, orb = self._classify(diff)
                if not aspect_def or orb is None:
                    continue
                pair = tuple(sorted((a, b)))
                aspects[pair] = {
                    "type": aspect_def.name,
                    "angle": aspect_def.angle,
                    "orb": round(float(orb), 2),
                    "difference": diff,
                    "icon": aspect_def.icon,
                }
        return aspects

    @staticmethod
    def _point_summary(point: dict) -> dict:
        return {
            "name": point.get("name"),
            "sign": point.get("sign"),
            "position": point.get("position"),
            "abs_pos": point.get("abs_pos"),
            "house": point.get("house"),
            "retrograde": point.get("retrograde"),
        }

    def compute(self, subject_data: dict, active_points: Optional[Iterable[str]] = None) -> list[dict]:
        points = self._extract_points(subject_data)
        keys = self._resolve_keys(points, active_points or subject_data.get("active_points"))
        results: list[dict] = []

        for i, base_key in enumerate(keys):
            base = points.get(base_key)
            if not base:
                continue
            base_abs = base.get("abs_pos")
            if base_abs is None:
                continue

            for other_key in keys[i + 1 :]:
                other = points.get(other_key)
                if not other:
                    continue
                other_abs = other.get("abs_pos")
                if other_abs is None:
                    continue

                diff = self._angular_diff(float(base_abs), float(other_abs))
                aspect_def, orb = self._classify(diff)
                if not aspect_def or orb is None:
                    continue
                orb_val = round(float(orb), 2)
                results.append(
                    {
                        "base_key": base_key,
                        "other_key": other_key,
                        "aspect_type": aspect_def.name,
                        "angle": aspect_def.angle,
                        "orb": orb_val,
                        "angle_difference": diff,
                        "icon": aspect_def.icon,
                        "aspect": {
                            "name": aspect_def.name,
                            "angle": aspect_def.angle,
                            "icon": aspect_def.icon,
                            "orb": orb_val,
                        },
                        "base": self._point_summary(base),
                        "other": self._point_summary(other),
                    }
                )

        results.sort(key=lambda row: row.get("orb", 9999.0))
        return results

    def _make_link(self, a: str, b: str, info: dict) -> AspectLink:
        return AspectLink(
            type=info["type"],
            pair=tuple(sorted((a, b))),
            orb=info["orb"],
            difference=info["difference"],
        )

    def _match_stellium(self, keys: list[str], points: dict[str, dict], pair_map: dict) -> list[PtolemaicAspect]:
        matches: list[PtolemaicAspect] = []
        seen: set[frozenset[str]] = set()
        # Use sorted angles with wrap-around to find clusters within ~30°
        ordered = sorted([(k, points[k]["abs_pos"]) for k in keys], key=lambda kv: kv[1])
        extended = ordered + [(k, pos + 360.0) for k, pos in ordered]
        start = 0
        for end in range(len(extended)):
            while extended[end][1] - extended[start][1] > 30.0:
                start += 1
            window = extended[start : end + 1]
            unique_keys = {k for k, _ in window}
            if len(unique_keys) < 3:
                continue
            key_set = frozenset(unique_keys)
            if key_set in seen:
                continue
            seen.add(key_set)
            links: list[AspectLink] = []
            for a, b in combinations(sorted(unique_keys), 2):
                info = pair_map.get(tuple(sorted((a, b))))
                if info and info["type"] == "conjunction":
                    links.append(self._make_link(a, b, info))
            matches.append(
                PtolemaicAspect(
                    configuration=next(p for p in PTOLEMAIC_PATTERNS if p.id == "stellium"),
                    points=tuple(sorted(unique_keys)),
                    links=tuple(links),
                    structure={"cluster": tuple(sorted(unique_keys))},
                )
            )
        return matches

    def _match_t_square(self, keys: list[str], points: dict[str, dict], pair_map: dict) -> list[PtolemaicAspect]:
        matches: list[PtolemaicAspect] = []
        seen: set[frozenset[str]] = set()
        config = next(p for p in PTOLEMAIC_PATTERNS if p.id == "t_square")
        for a, b, c in combinations(keys, 3):
            triplet = (a, b, c)
            combos = [
                (triplet[0], triplet[1], triplet[2]),
                (triplet[0], triplet[2], triplet[1]),
                (triplet[1], triplet[0], triplet[2]),
            ]
            for x, focal, y in combos:
                opp = pair_map.get(tuple(sorted((x, y))))
                sq1 = pair_map.get(tuple(sorted((x, focal))))
                sq2 = pair_map.get(tuple(sorted((focal, y))))
                if opp and opp["type"] == "opposition" and sq1 and sq2 and sq1["type"] == sq2["type"] == "square":
                    key_set = frozenset((x, focal, y))
                    if key_set in seen:
                        continue
                    seen.add(key_set)
                    links = [
                        self._make_link(x, y, opp),
                        self._make_link(x, focal, sq1),
                        self._make_link(focal, y, sq2),
                    ]
                    matches.append(
                        PtolemaicAspect(
                            configuration=config,
                            points=tuple(sorted(key_set)),
                            links=tuple(links),
                            structure={"focal": focal},
                        )
                    )
                    break
        return matches

    def _match_grand_trine(self, keys: list[str], points: dict[str, dict], pair_map: dict) -> list[PtolemaicAspect]:
        matches: list[PtolemaicAspect] = []
        seen: set[frozenset[str]] = set()
        config = next(p for p in PTOLEMAIC_PATTERNS if p.id == "grand_trine")
        for a, b, c in combinations(keys, 3):
            info_ab = pair_map.get(tuple(sorted((a, b))))
            info_ac = pair_map.get(tuple(sorted((a, c))))
            info_bc = pair_map.get(tuple(sorted((b, c))))
            if all(info and info["type"] == "trine" for info in (info_ab, info_ac, info_bc)):
                key_set = frozenset((a, b, c))
                if key_set in seen:
                    continue
                seen.add(key_set)
                links = [
                    self._make_link(a, b, info_ab),
                    self._make_link(a, c, info_ac),
                    self._make_link(b, c, info_bc),
                ]
                matches.append(
                    PtolemaicAspect(
                        configuration=config,
                        points=tuple(sorted(key_set)),
                        links=tuple(links),
                        structure={"triple": tuple(sorted(key_set))},
                    )
                )
        return matches

    def _match_grand_cross(self, keys: list[str], points: dict[str, dict], pair_map: dict) -> list[PtolemaicAspect]:
        matches: list[PtolemaicAspect] = []
        seen: set[frozenset[str]] = set()
        config = next(p for p in PTOLEMAIC_PATTERNS if p.id == "grand_cross")
        for a, b, c, d in combinations(keys, 4):
            key_set = frozenset((a, b, c, d))
            if key_set in seen:
                continue
            opp_pairs = []
            for p, q in combinations((a, b, c, d), 2):
                info = pair_map.get(tuple(sorted((p, q))))
                if info and info["type"] == "opposition":
                    opp_pairs.append(((p, q), info))
            # Need two disjoint oppositions covering all four points.
            for (opp1, info1), (opp2, info2) in combinations(opp_pairs, 2):
                if set(opp1) | set(opp2) != set((a, b, c, d)):
                    continue
                square_pairs = [
                    pair_map.get(tuple(sorted((opp1[0], opp2[0])))),
                    pair_map.get(tuple(sorted((opp1[0], opp2[1])))),
                    pair_map.get(tuple(sorted((opp1[1], opp2[0])))),
                    pair_map.get(tuple(sorted((opp1[1], opp2[1])))),
                ]
                if not all(info and info["type"] == "square" for info in square_pairs):
                    continue
                seen.add(key_set)
                links = [
                    self._make_link(*opp1, info1),
                    self._make_link(*opp2, info2),
                    self._make_link(opp1[0], opp2[0], square_pairs[0]),
                    self._make_link(opp1[0], opp2[1], square_pairs[1]),
                    self._make_link(opp1[1], opp2[0], square_pairs[2]),
                    self._make_link(opp1[1], opp2[1], square_pairs[3]),
                ]
                matches.append(
                    PtolemaicAspect(
                        configuration=config,
                        points=tuple(sorted(key_set)),
                        links=tuple(links),
                        structure={"axes": (opp1, opp2)},
                    )
                )
                break
        return matches

    def _match_grand_sextile(self, keys: list[str], points: dict[str, dict], pair_map: dict) -> list[PtolemaicAspect]:
        matches: list[PtolemaicAspect] = []
        seen: set[frozenset[str]] = set()
        config = next(p for p in PTOLEMAIC_PATTERNS if p.id == "grand_sextile")
        for combo in combinations(keys, 6):
            ordered = sorted(combo, key=lambda k: points[k]["abs_pos"])
            # Check sextile ring
            sextile_ok = True
            sextile_links: list[AspectLink] = []
            for i in range(6):
                a, b = ordered[i], ordered[(i + 1) % 6]
                info = pair_map.get(tuple(sorted((a, b))))
                if not info or info["type"] != "sextile":
                    sextile_ok = False
                    break
                sextile_links.append(self._make_link(a, b, info))
            if not sextile_ok:
                continue
            # Check alternating trines
            trine_links: list[AspectLink] = []
            trine_ok = True
            for i in range(6):
                a, b = ordered[i], ordered[(i + 2) % 6]
                info = pair_map.get(tuple(sorted((a, b))))
                if not info or info["type"] != "trine":
                    trine_ok = False
                    break
                trine_links.append(self._make_link(a, b, info))
            if not trine_ok:
                continue
            key_set = frozenset(ordered)
            if key_set in seen:
                continue
            seen.add(key_set)
            links = sextile_links + trine_links
            matches.append(
                PtolemaicAspect(
                    configuration=config,
                    points=tuple(ordered),
                    links=tuple(links),
                    structure={"triples": (tuple(ordered[0::2]), tuple(ordered[1::2]))},
                )
            )
        return matches

    def _match_mystic_rectangle(self, keys: list[str], points: dict[str, dict], pair_map: dict) -> list[PtolemaicAspect]:
        matches: list[PtolemaicAspect] = []
        seen: set[frozenset[str]] = set()
        config = next(p for p in PTOLEMAIC_PATTERNS if p.id == "mystic_rectangle")
        for a, b, c, d in combinations(keys, 4):
            opp_ac = pair_map.get(tuple(sorted((a, c))))
            opp_bd = pair_map.get(tuple(sorted((b, d))))
            if not (opp_ac and opp_bd and opp_ac["type"] == opp_bd["type"] == "opposition"):
                continue
            tr_ab = pair_map.get(tuple(sorted((a, b))))
            tr_cd = pair_map.get(tuple(sorted((c, d))))
            sx_bd = pair_map.get(tuple(sorted((b, c))))
            sx_da = pair_map.get(tuple(sorted((d, a))))
            if not all(
                [
                    tr_ab and tr_ab["type"] == "trine",
                    tr_cd and tr_cd["type"] == "trine",
                    sx_bd and sx_bd["type"] == "sextile",
                    sx_da and sx_da["type"] == "sextile",
                ]
            ):
                continue
            key_set = frozenset((a, b, c, d))
            if key_set in seen:
                continue
            seen.add(key_set)
            links = [
                self._make_link(a, c, opp_ac),
                self._make_link(b, d, opp_bd),
                self._make_link(a, b, tr_ab),
                self._make_link(c, d, tr_cd),
                self._make_link(b, c, sx_bd),
                self._make_link(d, a, sx_da),
            ]
            matches.append(
                PtolemaicAspect(
                    configuration=config,
                    points=tuple(sorted(key_set)),
                    links=tuple(links),
                    structure={"oppositions": ((a, c), (b, d))},
                )
            )
        return matches

    def _match_trapeze(self, keys: list[str], points: dict[str, dict], pair_map: dict) -> list[PtolemaicAspect]:
        matches: list[PtolemaicAspect] = []
        seen: set[frozenset[str]] = set()
        config = next(p for p in PTOLEMAIC_PATTERNS if p.id == "trapeze")
        for combo in combinations(keys, 4):
            ordered = sorted(combo, key=lambda k: points[k]["abs_pos"])
            a, b, c, d = ordered
            sx_ab = pair_map.get(tuple(sorted((a, b))))
            sx_bc = pair_map.get(tuple(sorted((b, c))))
            sx_cd = pair_map.get(tuple(sorted((c, d))))
            opp_ad = pair_map.get(tuple(sorted((a, d))))
            if not all(
                [
                    sx_ab and sx_ab["type"] == "sextile",
                    sx_bc and sx_bc["type"] == "sextile",
                    sx_cd and sx_cd["type"] == "sextile",
                    opp_ad and opp_ad["type"] == "opposition",
                ]
            ):
                continue
            key_set = frozenset(combo)
            if key_set in seen:
                continue
            seen.add(key_set)
            links = [
                self._make_link(a, b, sx_ab),
                self._make_link(b, c, sx_bc),
                self._make_link(c, d, sx_cd),
                self._make_link(a, d, opp_ad),
            ]
            matches.append(
                PtolemaicAspect(
                    configuration=config,
                    points=tuple(ordered),
                    links=tuple(links),
                    structure={"chain": (a, b, c, d)},
                )
            )
        return matches

    def compute_patterns(self, subject_data: dict, active_points: Optional[Iterable[str]] = None) -> list[PtolemaicAspect]:
        """
        Run pattern strategies for all configurations and return matches.
        """
        points = self._extract_points(subject_data)
        keys = self._resolve_keys(points, active_points or subject_data.get("active_points"))
        if not keys:
            return []
        pair_map = self._pair_aspects(points, keys)

        strategies = [
            self._match_stellium,
            self._match_t_square,
            self._match_grand_trine,
            self._match_grand_cross,
            self._match_grand_sextile,
            self._match_mystic_rectangle,
            self._match_trapeze,
        ]

        matches: list[PtolemaicAspect] = []
        for strategy in strategies:
            matches.extend(strategy(keys, points, pair_map))
        return matches


def compute_major_aspects(subject_data: dict, active_points: Optional[Iterable[str]] = None) -> list[dict]:
    """
    Convenience wrapper to compute high-level Ptolemaic configurations as JSON-ready dicts.
    """
    patterns = PtolemaicAspectCalculator().compute_patterns(subject_data, active_points=active_points)
    return serialize_ptolemaic_aspects(patterns)


def compute_ptolemaic_patterns(subject_data: dict, active_points: Optional[Iterable[str]] = None) -> list[PtolemaicAspect]:
    """
    Convenience wrapper to compute high-level Ptolemaic configurations.
    """
    return PtolemaicAspectCalculator().compute_patterns(subject_data, active_points=active_points)


def serialize_ptolemaic_aspects(aspects: Iterable[PtolemaicAspect]) -> list[dict]:
    """
    Convert a sequence of PtolemaicAspect instances into JSON-serializable dicts.
    """
    return [aspect.to_dict() for aspect in aspects]
