"""
Range-native aspect spans for the advanced timeline.

The public endpoint asks for a time range and receives lifecycle-style spans:
enter range, exact/min orb, exit range, confidence, movement, owners, and sample
counts. Transit mode compares moving transit points to each other. Natal-transit
mode compares fixed natal points to moving transit points.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from itertools import combinations, product
from typing import Callable, Optional

from service.schemas import BirthData, ChartConfig
from service.utils.config import ensure_config
from service.utils.subjects import build_subject, build_subject_for_moment

ASPECT_ANGLES = {
    "conjunction": 0,
    "semisextile": 30,
    "sextile": 60,
    "square": 90,
    "trine": 120,
    "quincunx": 150,
    "opposition": 180,
}

DEFAULT_ORBS = {
    "conjunction": 8,
    "semisextile": 2,
    "sextile": 6,
    "square": 7,
    "trine": 8,
    "quincunx": 3,
    "opposition": 8,
}

FAST_POINTS = {"moon", "sun", "mercury", "venus", "mars", "ascendant", "medium_coeli"}
VERY_FAST_POINTS = {"ascendant", "descendant", "medium_coeli", "imum_coeli"}
MAX_BOUNDARY_SEARCH_STEPS = 5000


@dataclass(frozen=True)
class AspectPair:
    left_key: str
    right_key: str
    left_label: str
    right_label: str
    left_owner: str
    right_owner: str
    mode: str


def _normalize_key(value: str) -> str:
    key = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {
        "asc": "ascendant",
        "dsc": "descendant",
        "mc": "medium_coeli",
        "ic": "imum_coeli",
        "midheaven": "medium_coeli",
        "north_node": "true_north_lunar_node",
        "south_node": "true_south_lunar_node",
        "semi_sextile": "semisextile",
    }
    return aliases.get(key, key)


def _label_from_key(key: str) -> str:
    return " ".join(part.capitalize() for part in _normalize_key(key).split("_") if part)


def _safe_float(value) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _get_abs_pos(subject_dict: dict, point_key: str) -> Optional[float]:
    norm = _normalize_key(point_key)
    point_data = subject_dict.get(norm)
    if isinstance(point_data, dict):
        parsed = _safe_float(point_data.get("abs_pos"))
        if parsed is not None:
            return parsed
    for val in subject_dict.values():
        if not isinstance(val, dict):
            continue
        name = _normalize_key(val.get("name", ""))
        if name == norm:
            parsed = _safe_float(val.get("abs_pos"))
            if parsed is not None:
                return parsed
    return None


def _point_label(subject_dict: dict, point_key: str) -> str:
    norm = _normalize_key(point_key)
    point_data = subject_dict.get(norm)
    if isinstance(point_data, dict) and point_data.get("name"):
        return str(point_data["name"]).replace("_", " ").title()
    return _label_from_key(norm)


def angular_difference(pos_a: float, pos_b: float) -> float:
    diff = abs(pos_a - pos_b) % 360
    return min(diff, 360 - diff)


def compute_orb_for_aspect(pos_a: float, pos_b: float, aspect_angle: float) -> float:
    return abs(angular_difference(pos_a, pos_b) - aspect_angle)


def _step_for_points(left_key: str, right_key: str, range_seconds: float) -> timedelta:
    lk = _normalize_key(left_key)
    rk = _normalize_key(right_key)
    has_moon = lk == "moon" or rk == "moon"
    has_fast = lk in FAST_POINTS or rk in FAST_POINTS
    days = range_seconds / 86_400
    if has_moon:
        if days <= 2:
            return timedelta(hours=1)
        if days <= 31:
            return timedelta(hours=3)
        return timedelta(hours=6)
    if has_fast:
        if days <= 2:
            return timedelta(hours=3)
        if days <= 31:
            return timedelta(hours=6)
        return timedelta(hours=12)
    if days <= 31:
        return timedelta(hours=6)
    return timedelta(days=1)


def _fine_step_for_points(left_key: str, right_key: str) -> timedelta:
    lk = _normalize_key(left_key)
    rk = _normalize_key(right_key)
    if lk == "moon" or rk == "moon":
        return timedelta(minutes=30)
    if lk in FAST_POINTS or rk in FAST_POINTS:
        return timedelta(hours=1)
    return timedelta(hours=3)


def _iter_times(start: datetime, end: datetime, step: timedelta):
    current = start
    while current <= end:
        yield current
        current += step
    if current - step < end:
        yield end


class PositionCache:
    def __init__(self, transit_base: BirthData, cfg: ChartConfig, active_points: list[str]):
        self.transit_base = transit_base
        self.cfg = cfg
        self.active_points = [_normalize_key(point) for point in active_points if point]
        self._transit: dict[datetime, tuple[dict[str, float], dict[str, str], dict[str, str]]] = {}

    def transit(self, dt: datetime) -> tuple[dict[str, float], dict[str, str], dict[str, str]]:
        cached = self._transit.get(dt)
        if cached is not None:
            return cached
        subject = build_subject_for_moment(self.transit_base, dt, self.cfg)
        data = subject.model_dump(mode="json")
        positions, labels, signs = _positions_from_subject(data, self.active_points)
        self._transit[dt] = (positions, labels, signs)
        return positions, labels, signs


def _point_payload(subject_dict: dict, point_key: str) -> Optional[dict]:
    norm = _normalize_key(point_key)
    point_data = subject_dict.get(norm)
    if isinstance(point_data, dict):
        return point_data
    for val in subject_dict.values():
        if not isinstance(val, dict):
            continue
        name = _normalize_key(val.get("name", ""))
        if name == norm:
            return val
    return None


def _point_sign(subject_dict: dict, point_key: str) -> str:
    point_data = _point_payload(subject_dict, point_key)
    if not isinstance(point_data, dict):
        return ""
    return str(point_data.get("sign") or point_data.get("sign_name") or point_data.get("signName") or "")


def _positions_from_subject(subject_dict: dict, active_points: list[str]) -> tuple[dict[str, float], dict[str, str], dict[str, str]]:
    positions: dict[str, float] = {}
    labels: dict[str, str] = {}
    signs: dict[str, str] = {}
    for point in active_points:
        key = _normalize_key(point)
        pos = _get_abs_pos(subject_dict, key)
        if pos is None:
            continue
        positions[key] = pos
        labels[key] = _point_label(subject_dict, key)
        signs[key] = _point_sign(subject_dict, key)
    return positions, labels, signs


def _confidence(clipped_start: bool, clipped_end: bool) -> str:
    if clipped_start and clipped_end:
        return "clipped_both"
    if clipped_start:
        return "clipped_start"
    if clipped_end:
        return "clipped_end"
    return "full"


def _span_id(pair: AspectPair, aspect_name: str, index: int) -> str:
    left = _normalize_key(pair.left_label)
    right = _normalize_key(pair.right_label)
    aspect = _normalize_key(aspect_name)
    return f"{pair.left_owner}:{left}:{aspect}:{pair.right_owner}:{right}:{index}"


def _movement_for(ts: datetime, exact_at: datetime) -> str:
    return "applying" if ts <= exact_at else "separating"


def _state_for(
    pair: AspectPair,
    aspect_angle: float,
    max_orb: float,
    left_positions: Callable[[datetime], Optional[float]],
    right_positions: Callable[[datetime], Optional[float]],
    dt: datetime,
) -> Optional[dict]:
    left_pos = left_positions(dt)
    right_pos = right_positions(dt)
    if left_pos is None or right_pos is None:
        return None
    orb = compute_orb_for_aspect(left_pos, right_pos, aspect_angle)
    return {"ts": dt, "orb": orb, "inside": orb <= max_orb}


def _refine_boundary(
    outside_dt: Optional[datetime],
    inside_dt: datetime,
    fine_step: timedelta,
    state_at: Callable[[datetime], Optional[dict]],
    entering: bool,
) -> datetime:
    if outside_dt is None:
        return inside_dt
    lo, hi = (outside_dt, inside_dt) if entering else (inside_dt, outside_dt)
    while (hi - lo) > fine_step:
        mid = lo + (hi - lo) / 2
        state = state_at(mid)
        is_inside = bool(state and state["inside"])
        if entering:
            if is_inside:
                hi = mid
            else:
                lo = mid
        else:
            if is_inside:
                lo = mid
            else:
                hi = mid
    return hi if entering else lo


def _refine_exact(
    best_sample: dict,
    start_at: datetime,
    end_at: datetime,
    scan_step: timedelta,
    fine_step: timedelta,
    state_at: Callable[[datetime], Optional[dict]],
) -> tuple[datetime, Optional[float]]:
    window_start = max(start_at, best_sample["ts"] - scan_step)
    window_end = min(end_at, best_sample["ts"] + scan_step)
    exact_at = best_sample["ts"]
    min_orb = best_sample["orb"]
    for dt in _iter_times(window_start, window_end, fine_step):
        state = state_at(dt)
        if state and state["orb"] < min_orb:
            exact_at = dt
            min_orb = state["orb"]
    return exact_at, round(min_orb, 4) if min_orb is not None else None


def _find_boundary_outside(
    inside_dt: datetime,
    direction: int,
    scan_step: timedelta,
    state_at: Callable[[datetime], Optional[dict]],
) -> tuple[Optional[datetime], bool]:
    current = inside_dt
    delta = scan_step if direction > 0 else -scan_step
    for _ in range(MAX_BOUNDARY_SEARCH_STEPS):
        candidate = current + delta
        state = state_at(candidate)
        if not state or not state["inside"]:
            return candidate, False
        current = candidate
    return None, True


def _locate_exact_in_span(
    start_at: datetime,
    end_at: datetime,
    scan_step: timedelta,
    fine_step: timedelta,
    state_at: Callable[[datetime], Optional[dict]],
    fallback_hits: list[dict],
) -> tuple[datetime, Optional[float]]:
    best: Optional[dict] = None
    for dt in _iter_times(start_at, end_at, scan_step):
        state = state_at(dt)
        if state and state["inside"] and (best is None or state["orb"] < best["orb"]):
            best = state
    if best is None and fallback_hits:
        best = min(fallback_hits, key=lambda hit: hit["orb"])
    if best is None:
        return start_at, None
    return _refine_exact(best, start_at, end_at, scan_step, fine_step, state_at)


def _span_boundaries_for_run(
    start_dt: datetime,
    end_dt: datetime,
    run_hits: list[dict],
    run_start_outside: Optional[datetime],
    end_outside: Optional[datetime],
    scan_step: timedelta,
    fine_step: timedelta,
    state_at: Callable[[datetime], Optional[dict]],
) -> tuple[datetime, datetime, datetime, Optional[float], bool, bool]:
    start_clipped = run_start_outside is None
    end_clipped = end_outside is None

    if start_clipped:
        outside_start, start_unresolved = _find_boundary_outside(run_hits[0]["ts"], -1, scan_step, state_at)
        if outside_start is not None:
            start_at = _refine_boundary(outside_start, run_hits[0]["ts"], fine_step, state_at, True)
            start_clipped = start_unresolved
        else:
            start_at = start_dt
    else:
        start_at = _refine_boundary(run_start_outside, run_hits[0]["ts"], fine_step, state_at, True)

    if end_clipped:
        outside_end, end_unresolved = _find_boundary_outside(run_hits[-1]["ts"], 1, scan_step, state_at)
        if outside_end is not None:
            end_at = _refine_boundary(outside_end, run_hits[-1]["ts"], fine_step, state_at, False)
            end_clipped = end_unresolved
        else:
            end_at = end_dt
    else:
        end_at = _refine_boundary(end_outside, run_hits[-1]["ts"], fine_step, state_at, False)

    exact_at, min_orb = _locate_exact_in_span(start_at, end_at, scan_step, fine_step, state_at, run_hits)
    return start_at, exact_at, end_at, min_orb, start_clipped, end_clipped


def _scan_pair_aspect(
    pair: AspectPair,
    aspect_name: str,
    start_dt: datetime,
    end_dt: datetime,
    left_positions: Callable[[datetime], Optional[float]],
    right_positions: Callable[[datetime], Optional[float]],
    left_sign: Callable[[datetime], str],
    right_sign: Callable[[datetime], str],
    run_index: int,
) -> tuple[list[dict], int]:
    aspect_key = _normalize_key(aspect_name)
    aspect_angle = ASPECT_ANGLES[aspect_key]
    max_orb = DEFAULT_ORBS[aspect_key]
    range_seconds = max((end_dt - start_dt).total_seconds(), 0)
    scan_step = _step_for_points(pair.left_key, pair.right_key, range_seconds)
    fine_step = _fine_step_for_points(pair.left_key, pair.right_key)

    def state_at(dt: datetime) -> Optional[dict]:
        return _state_for(pair, aspect_angle, max_orb, left_positions, right_positions, dt)

    spans: list[dict] = []
    prev: Optional[dict] = None
    run_hits: list[dict] = []
    run_start_outside: Optional[datetime] = None

    for dt in _iter_times(start_dt, end_dt, scan_step):
        current = state_at(dt)
        if current is None:
            if run_hits:
                run_start_outside = prev["ts"] if prev and not prev.get("inside") else None
                run_hits = []
            prev = None
            continue

        if current["inside"]:
            if not run_hits:
                run_start_outside = prev["ts"] if prev and not prev["inside"] else None
            run_hits.append(current)
        elif run_hits:
            start_at, exact_at, end_at, min_orb, start_clipped, end_clipped = _span_boundaries_for_run(
                start_dt,
                end_dt,
                run_hits,
                run_start_outside,
                current["ts"],
                scan_step,
                fine_step,
                state_at,
            )
            spans.append(_make_span(pair, aspect_name, start_at, exact_at, end_at, min_orb, left_sign(exact_at), right_sign(exact_at), start_clipped, end_clipped, run_hits, run_index))
            run_index += 1
            run_hits = []
            run_start_outside = None
        prev = current

    if run_hits:
        start_at, exact_at, end_at, min_orb, start_clipped, end_clipped = _span_boundaries_for_run(
            start_dt,
            end_dt,
            run_hits,
            run_start_outside,
            None,
            scan_step,
            fine_step,
            state_at,
        )
        spans.append(_make_span(pair, aspect_name, start_at, exact_at, end_at, min_orb, left_sign(exact_at), right_sign(exact_at), start_clipped, end_clipped, run_hits, run_index))
        run_index += 1

    return spans, run_index


def _make_span(
    pair: AspectPair,
    aspect_name: str,
    start_at: datetime,
    exact_at: datetime,
    end_at: datetime,
    min_orb: Optional[float],
    left_sign: str,
    right_sign: str,
    clipped_start: bool,
    clipped_end: bool,
    hits: list[dict],
    run_index: int,
) -> dict:
    return {
        "id": _span_id(pair, aspect_name, run_index),
        "left": pair.left_label,
        "right": pair.right_label,
        "aspect": aspect_name,
        "aspectType": aspect_name,
        "leftOwner": pair.left_owner,
        "rightOwner": pair.right_owner,
        "leftSign": left_sign,
        "rightSign": right_sign,
        "signLeft": left_sign,
        "signRight": right_sign,
        "startAt": start_at.isoformat(),
        "exactAt": exact_at.isoformat(),
        "endAt": end_at.isoformat(),
        "applying_start": start_at.isoformat(),
        "exact_at": exact_at.isoformat(),
        "separating_end": end_at.isoformat(),
        "minOrb": min_orb,
        "min_orb": min_orb,
        "movementStart": _movement_for(start_at, exact_at),
        "movementEnd": _movement_for(end_at, exact_at),
        "confidence": _confidence(clipped_start, clipped_end),
        "samples": len(hits),
        "duration_hours": round((end_at - start_at).total_seconds() / 3600, 2),
        "mode": pair.mode,
    }


def _active_points(cfg: ChartConfig) -> list[str]:
    points = [_normalize_key(point) for point in (cfg.active_points or []) if point]
    return list(dict.fromkeys(points))


def _moving_active_points_for_range(active_points: list[str], start_dt: datetime, end_dt: datetime) -> list[str]:
    days = max((end_dt - start_dt).total_seconds(), 0) / 86_400
    filtered = []
    for point in active_points:
        normalized = _normalize_key(point)
        if days > 1 and normalized in VERY_FAST_POINTS:
            continue
        if days >= 30 and normalized == "moon":
            continue
        if days >= 365 and normalized in {"mercury", "venus"}:
            continue
        filtered.append(point)
    return filtered


def _transit_pairs(labels: dict[str, str], active_points: list[str]) -> list[AspectPair]:
    available = [point for point in active_points if point in labels]
    return [
        AspectPair(a, b, labels.get(a, _label_from_key(a)), labels.get(b, _label_from_key(b)), "Transit", "Transit", "transit")
        for a, b in combinations(available, 2)
    ]


def _natal_transit_pairs(
    natal_labels: dict[str, str],
    transit_labels: dict[str, str],
    natal_active_points: list[str],
    transit_active_points: list[str],
) -> list[AspectPair]:
    natal_points = [point for point in natal_active_points if point in natal_labels]
    transit_points = [point for point in transit_active_points if point in transit_labels]
    return [
        AspectPair(natal, transit, natal_labels.get(natal, _label_from_key(natal)), transit_labels.get(transit, _label_from_key(transit)), "Natal", "Transit", "natal_transit")
        for natal, transit in product(natal_points, transit_points)
    ]


def compute_range_aspect_spans(
    transit_base: BirthData,
    cfg: ChartConfig,
    start_dt: datetime,
    end_dt: datetime,
    mode: str = "transit",
    birth: Optional[BirthData] = None,
) -> dict:
    config = ensure_config(cfg)
    active_points = _active_points(config)
    transit_active_points = _moving_active_points_for_range(active_points, start_dt, end_dt)
    cache = PositionCache(transit_base, config, transit_active_points)
    _start_positions, start_labels, _start_signs = cache.transit(start_dt)
    normalized_mode = "natal_transit" if mode == "natal_transit" and birth is not None else "transit"

    natal_positions: dict[str, float] = {}
    natal_labels: dict[str, str] = {}
    if normalized_mode == "natal_transit" and birth is not None:
        natal_subject = build_subject(birth, config)
        natal_positions, natal_labels, natal_signs = _positions_from_subject(natal_subject.model_dump(mode="json"), active_points)
        pairs = _natal_transit_pairs(natal_labels, start_labels, active_points, transit_active_points)
    else:
        pairs = _transit_pairs(start_labels, transit_active_points)

    spans: list[dict] = []
    run_index = 0
    for pair in pairs:
        if pair.mode == "natal_transit":
            left_positions = lambda _dt, key=pair.left_key: natal_positions.get(key)
            right_positions = lambda dt, key=pair.right_key: cache.transit(dt)[0].get(key)
            left_sign = lambda _dt, key=pair.left_key: natal_signs.get(key, "")
            right_sign = lambda dt, key=pair.right_key: cache.transit(dt)[2].get(key, "")
        else:
            left_positions = lambda dt, key=pair.left_key: cache.transit(dt)[0].get(key)
            right_positions = lambda dt, key=pair.right_key: cache.transit(dt)[0].get(key)
            left_sign = lambda dt, key=pair.left_key: cache.transit(dt)[2].get(key, "")
            right_sign = lambda dt, key=pair.right_key: cache.transit(dt)[2].get(key, "")

        for aspect_name in ASPECT_ANGLES:
            found, run_index = _scan_pair_aspect(
                pair,
                aspect_name,
                start_dt,
                end_dt,
                left_positions,
                right_positions,
                left_sign,
                right_sign,
                run_index,
            )
            spans.extend(found)

    spans.sort(key=lambda span: (span["startAt"], span["exactAt"], span["minOrb"] if span["minOrb"] is not None else 9999))
    return {
        "mode": normalized_mode,
        "start": start_dt.isoformat(),
        "end": end_dt.isoformat(),
        "spans": spans,
        "spans_count": len(spans),
        "candidate_pairs": len(pairs),
        "points_count": len(transit_active_points),
        "configured_points_count": len(active_points),
        "moving_points": transit_active_points,
        "timestamps_evaluated": len(cache._transit),
    }


def find_aspect_span(
    base: BirthData,
    cfg,
    ref_dt: datetime,
    left_key: str,
    right_key: str,
    aspect_name: str,
    max_orb: float,
) -> Optional[dict]:
    """Backward-compatible wrapper around a small centered range."""
    window = timedelta(days=3 if "moon" in {_normalize_key(left_key), _normalize_key(right_key)} else 30)
    result = compute_range_aspect_spans(base, cfg, ref_dt - window, ref_dt + window)
    for span in result["spans"]:
        if (
            _normalize_key(span["left"]) == _normalize_key(left_key)
            and _normalize_key(span["right"]) == _normalize_key(right_key)
            and _normalize_key(span["aspect"]) == _normalize_key(aspect_name)
            and span["startAt"] <= ref_dt.isoformat() <= span["endAt"]
        ):
            return {
                "applying_start": datetime.fromisoformat(span["startAt"]),
                "exact_at": datetime.fromisoformat(span["exactAt"]),
                "separating_end": datetime.fromisoformat(span["endAt"]),
                "min_orb": span["minOrb"],
            }
    return None


def compute_aspect_spans(
    base: BirthData,
    cfg: ChartConfig,
    ref_dt: datetime,
    aspects: list[dict],
) -> list[dict]:
    """Backward-compatible single-reference API used by older tests/callers."""
    end_dt = ref_dt + timedelta(days=30)
    result = compute_range_aspect_spans(base, cfg, ref_dt, end_dt)
    return result["spans"]
