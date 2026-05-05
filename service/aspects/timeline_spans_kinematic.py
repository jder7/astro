"""
Kinematic aspect span estimation for the advanced timeline.

This module keeps the existing range-native response contract, but estimates
full lifecycle boundaries from local relative motion instead of walking
linearly outside the requested range.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
from itertools import combinations, product
from typing import Optional

from service.schemas import BirthData, ChartConfig
from service.utils.config import ensure_config
from service.utils.subjects import build_subject
from service.aspects.timeline_spans import (
    ASPECT_ANGLES,
    DEFAULT_ORBS,
    AspectPair,
    PositionCache,
    _active_points,
    _confidence,
    _fine_step_for_points,
    _iter_times,
    _label_from_key,
    _make_span,
    _moving_active_points_for_range,
    _normalize_key,
    _positions_from_subject,
    _refine_boundary,
    _step_for_points,
)


def _signed_diff(a: float, b: float) -> float:
    return ((a - b + 180.0) % 360.0) - 180.0


def _target_angles(aspect_angle: float) -> list[float]:
    normalized = aspect_angle % 360.0
    mirror = (-aspect_angle) % 360.0
    if abs(_signed_diff(normalized, mirror)) < 1e-9:
        return [normalized]
    return [normalized, mirror]


def _delta_for_target(left_pos: float, right_pos: float, target: float) -> float:
    separation = (right_pos - left_pos) % 360.0
    return _signed_diff(separation, target)


def _nearest_delta(left_pos: float, right_pos: float, aspect_angle: float) -> tuple[float, float]:
    candidates = [(target, _delta_for_target(left_pos, right_pos, target)) for target in _target_angles(aspect_angle)]
    return min(candidates, key=lambda item: abs(item[1]))


def _dt_seconds(a: datetime, b: datetime) -> float:
    return (a - b).total_seconds()


def _kinematic_step_for_points(left_key: str, right_key: str, range_seconds: float) -> timedelta:
    days = range_seconds / 86_400
    if days >= 365:
        return timedelta(days=1)
    return _step_for_points(left_key, right_key, range_seconds)


def _series_key(span: dict) -> tuple[str, str, str, str, str, str, str]:
    return (
        _normalize_key(span.get("leftOwner", "")),
        _normalize_key(span.get("left", "")),
        _normalize_key(span.get("aspect", "")),
        _normalize_key(span.get("rightOwner", "")),
        _normalize_key(span.get("right", "")),
        _normalize_key(span.get("leftSign", "")),
        _normalize_key(span.get("rightSign", "")),
    )


def _pass_payload(span: dict, index: int, count: int, series_id: str) -> dict:
    return {
        "id": f"{series_id}:pass:{index}",
        "seriesId": series_id,
        "seriesIndex": index,
        "seriesCount": count,
        "startAt": span["startAt"],
        "exactAt": span["exactAt"],
        "endAt": span["endAt"],
        "applying_start": span["applying_start"],
        "exact_at": span["exact_at"],
        "separating_end": span["separating_end"],
        "minOrb": span.get("minOrb"),
        "min_orb": span.get("min_orb"),
        "movementStart": span.get("movementStart", ""),
        "movementEnd": span.get("movementEnd", ""),
        "confidence": span.get("confidence", "full"),
        "samples": span.get("samples", 0),
        "leftSign": span.get("leftSign", ""),
        "rightSign": span.get("rightSign", ""),
        "signLeft": span.get("signLeft", ""),
        "signRight": span.get("signRight", ""),
        "engine": span.get("engine", "kinematic"),
    }


def _span_start(span: dict) -> datetime:
    return datetime.fromisoformat(span["startAt"])


def _span_end(span: dict) -> datetime:
    return datetime.fromisoformat(span["endAt"])


def _span_interval_groups(spans: list[dict]) -> list[list[dict]]:
    ordered = sorted(spans, key=lambda item: (_span_start(item), item["exactAt"]))
    groups: list[list[dict]] = []
    current: list[dict] = []
    current_end: Optional[datetime] = None

    for span in ordered:
        start = _span_start(span)
        end = _span_end(span)
        if not current or (current_end is not None and start <= current_end):
            current.append(span)
            current_end = end if current_end is None or end > current_end else current_end
            continue
        groups.append(current)
        current = [span]
        current_end = end

    if current:
        groups.append(current)
    return groups


def _ensure_single_pass(span: dict) -> dict:
    if span.get("passes"):
        return span
    series_id = span.get("seriesId") or span["id"]
    span["seriesId"] = series_id
    span["seriesCount"] = 1
    span["isRetrogradeSeries"] = False
    span["passes"] = [_pass_payload(span, 1, 1, series_id)]
    return span


def _collapse_pass_group(group: list[dict]) -> dict:
    ordered = sorted(group, key=lambda item: item["exactAt"])
    if len(ordered) == 1:
        return _ensure_single_pass(ordered[0])

    parent = dict(ordered[0])
    series_id = parent["id"].rsplit(":", 1)[0] + ":series"
    passes = [_pass_payload(span, index + 1, len(ordered), series_id) for index, span in enumerate(ordered)]
    min_orb_values = [span.get("minOrb") for span in ordered if span.get("minOrb") is not None]
    exact_anchor = min(ordered, key=lambda span: span.get("minOrb") if span.get("minOrb") is not None else 9999)

    parent["id"] = series_id
    parent["startAt"] = min(span["startAt"] for span in ordered)
    parent["endAt"] = max(span["endAt"] for span in ordered)
    parent["applying_start"] = parent["startAt"]
    parent["separating_end"] = parent["endAt"]
    parent["exactAt"] = exact_anchor["exactAt"]
    parent["exact_at"] = exact_anchor["exactAt"]
    parent["minOrb"] = min(min_orb_values) if min_orb_values else None
    parent["min_orb"] = parent["minOrb"]
    parent["confidence"] = _confidence(
        any(span.get("confidence") in {"clipped_start", "clipped_both"} for span in ordered),
        any(span.get("confidence") in {"clipped_end", "clipped_both"} for span in ordered),
    )
    parent["samples"] = sum(int(span.get("samples") or 0) for span in ordered)
    parent["seriesId"] = series_id
    parent["seriesCount"] = len(ordered)
    parent["isRetrogradeSeries"] = True
    parent["passes"] = passes
    return parent


def _collapse_overlapping_pass_series(spans: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str, str, str, str, str, str], list[dict]] = {}
    for span in spans:
        grouped.setdefault(_series_key(span), []).append(span)

    collapsed: list[dict] = []
    for group in grouped.values():
        for interval_group in _span_interval_groups(group):
            collapsed.append(_collapse_pass_group(interval_group))

    return collapsed


class KinematicAspectSpanCalculator:
    def __init__(
        self,
        transit_base: BirthData,
        cfg: ChartConfig,
        start_dt: datetime,
        end_dt: datetime,
        mode: str = "transit",
        birth: Optional[BirthData] = None,
    ):
        self.transit_base = transit_base
        self.config = ensure_config(cfg)
        self.start_dt = start_dt
        self.end_dt = end_dt
        self.birth = birth
        self.normalized_mode = "natal_transit" if mode == "natal_transit" and birth is not None else "transit"
        self.active_points = _active_points(self.config)
        self.transit_active_points = _moving_active_points_for_range(self.active_points, start_dt, end_dt)
        self.cache = PositionCache(transit_base, self.config, self.transit_active_points)
        self.boundary_predictions = 0
        self.boundary_fallbacks = 0
        self.refinement_checks = 0

    def compute(self) -> dict:
        _start_positions, start_labels, _start_signs = self.cache.transit(self.start_dt)
        natal_positions: dict[str, float] = {}
        natal_labels: dict[str, str] = {}
        natal_signs: dict[str, str] = {}

        if self.normalized_mode == "natal_transit" and self.birth is not None:
            natal_subject = build_subject(self.birth, self.config)
            natal_positions, natal_labels, natal_signs = _positions_from_subject(
                natal_subject.model_dump(mode="json"),
                self.active_points,
            )
            pairs = self._natal_transit_pairs(natal_labels, start_labels)
        else:
            pairs = self._transit_pairs(start_labels)

        spans: list[dict] = []
        run_index = 0
        for pair in pairs:
            pair_state = self._pair_state(pair, natal_positions, natal_signs)
            for aspect_name in ASPECT_ANGLES:
                found, run_index = self._scan_pair_aspect(pair, aspect_name, pair_state, run_index)
                spans.extend(found)

        spans = _collapse_overlapping_pass_series(spans)
        spans.sort(key=lambda span: (span["startAt"], span["exactAt"], span["minOrb"] if span["minOrb"] is not None else 9999))
        return {
            "mode": self.normalized_mode,
            "engine": "kinematic",
            "start": self.start_dt.isoformat(),
            "end": self.end_dt.isoformat(),
            "spans": spans,
            "spans_count": len(spans),
            "candidate_pairs": len(pairs),
            "points_count": len(self.transit_active_points),
            "configured_points_count": len(self.active_points),
            "moving_points": self.transit_active_points,
            "timestamps_evaluated": len(self.cache._transit),
            "boundary_predictions": self.boundary_predictions,
            "boundary_fallbacks": self.boundary_fallbacks,
            "refinement_checks": self.refinement_checks,
        }

    def _transit_pairs(self, labels: dict[str, str]) -> list[AspectPair]:
        available = [point for point in self.transit_active_points if point in labels]
        return [
            AspectPair(a, b, labels.get(a, _label_from_key(a)), labels.get(b, _label_from_key(b)), "Transit", "Transit", "transit")
            for a, b in combinations(available, 2)
        ]

    def _natal_transit_pairs(self, natal_labels: dict[str, str], transit_labels: dict[str, str]) -> list[AspectPair]:
        natal_points = [point for point in self.active_points if point in natal_labels]
        transit_points = [point for point in self.transit_active_points if point in transit_labels]
        return [
            AspectPair(natal, transit, natal_labels.get(natal, _label_from_key(natal)), transit_labels.get(transit, _label_from_key(transit)), "Natal", "Transit", "natal_transit")
            for natal, transit in product(natal_points, transit_points)
        ]

    def _pair_state(self, pair: AspectPair, natal_positions: dict[str, float], natal_signs: dict[str, str]) -> dict:
        if pair.mode == "natal_transit":
            return {
                "left_position": lambda _dt, key=pair.left_key: natal_positions.get(key),
                "right_position": lambda dt, key=pair.right_key: self.cache.transit(dt)[0].get(key),
                "left_sign": lambda _dt, key=pair.left_key: natal_signs.get(key, ""),
                "right_sign": lambda dt, key=pair.right_key: self.cache.transit(dt)[2].get(key, ""),
            }
        return {
            "left_position": lambda dt, key=pair.left_key: self.cache.transit(dt)[0].get(key),
            "right_position": lambda dt, key=pair.right_key: self.cache.transit(dt)[0].get(key),
            "left_sign": lambda dt, key=pair.left_key: self.cache.transit(dt)[2].get(key, ""),
            "right_sign": lambda dt, key=pair.right_key: self.cache.transit(dt)[2].get(key, ""),
        }

    def _state_at(self, pair_state: dict, aspect_angle: float, max_orb: float, dt: datetime, target: Optional[float] = None) -> Optional[dict]:
        left_pos = pair_state["left_position"](dt)
        right_pos = pair_state["right_position"](dt)
        if left_pos is None or right_pos is None:
            return None
        if target is None:
            target, delta = _nearest_delta(left_pos, right_pos, aspect_angle)
        else:
            delta = _delta_for_target(left_pos, right_pos, target)
        orb = abs(delta)
        return {"ts": dt, "delta": delta, "orb": orb, "inside": orb <= max_orb, "target": target}

    def _velocity_at(self, pair_state: dict, aspect_angle: float, center: datetime, target: float, step: timedelta) -> Optional[float]:
        half_step = max(step / 2, timedelta(hours=1))
        before = self._state_at(pair_state, aspect_angle, 0, center - half_step, target)
        after = self._state_at(pair_state, aspect_angle, 0, center + half_step, target)
        if not before or not after:
            return None
        seconds = _dt_seconds(after["ts"], before["ts"])
        if abs(seconds) < 1:
            return None
        return _signed_diff(after["delta"], before["delta"]) / seconds

    def _predict_boundary_dt(
        self,
        inside_state: dict,
        velocity: Optional[float],
        max_orb: float,
        direction: int,
        scan_step: timedelta,
    ) -> Optional[datetime]:
        if velocity is None or abs(velocity) < 1e-10:
            return None
        candidates = []
        for boundary_delta in (max_orb, -max_orb):
            offset_seconds = (boundary_delta - inside_state["delta"]) / velocity
            if direction < 0 and offset_seconds < -1:
                candidates.append(offset_seconds)
            elif direction > 0 and offset_seconds > 1:
                candidates.append(offset_seconds)
        if not candidates:
            return None
        chosen = max(candidates) if direction < 0 else min(candidates)
        max_horizon = max(scan_step.total_seconds() * 64, 20 * 365.25 * 86_400)
        if abs(chosen) > max_horizon:
            return None
        self.boundary_predictions += 1
        try:
            return inside_state["ts"] + timedelta(seconds=chosen)
        except OverflowError:
            return None

    def _find_outside_near_prediction(
        self,
        pair_state: dict,
        aspect_angle: float,
        max_orb: float,
        inside_state: dict,
        target: float,
        direction: int,
        predicted: Optional[datetime],
        scan_step: timedelta,
    ) -> Optional[datetime]:
        state_at = lambda dt: self._state_at(pair_state, aspect_angle, max_orb, dt, target)
        probes = []
        if predicted is not None:
            probes.extend([predicted, predicted + direction * scan_step, predicted + direction * scan_step * 2])
        probes.extend([inside_state["ts"] + direction * scan_step * (2 ** i) for i in range(0, 16)])
        for probe in probes:
            state = state_at(probe)
            self.refinement_checks += 1
            if not state or not state["inside"]:
                return probe
        self.boundary_fallbacks += 1
        return None

    def _find_near_outside(
        self,
        pair_state: dict,
        aspect_angle: float,
        max_orb: float,
        inside_state: dict,
        target: float,
        direction: int,
        scan_step: timedelta,
        max_steps: int = 64,
    ) -> Optional[datetime]:
        state_at = lambda dt: self._state_at(pair_state, aspect_angle, max_orb, dt, target)
        current = inside_state["ts"]
        delta = scan_step if direction > 0 else -scan_step
        for _ in range(max_steps):
            candidate = current + delta
            state = state_at(candidate)
            self.refinement_checks += 1
            if not state or not state["inside"]:
                return candidate
            current = candidate
        return None

    def _refine_predicted_boundary(
        self,
        pair_state: dict,
        aspect_angle: float,
        max_orb: float,
        inside_state: dict,
        target: float,
        direction: int,
        scan_step: timedelta,
        fine_step: timedelta,
        velocity: Optional[float] = None,
    ) -> tuple[datetime, bool]:
        if velocity is None:
            velocity = self._velocity_at(pair_state, aspect_angle, inside_state["ts"], target, scan_step)
        near_outside = self._find_near_outside(pair_state, aspect_angle, max_orb, inside_state, target, direction, scan_step)
        if near_outside is not None:
            state_at = lambda dt: self._state_at(pair_state, aspect_angle, max_orb, dt, target)
            entering = direction < 0
            return _refine_boundary(near_outside, inside_state["ts"], fine_step, state_at, entering), False
        predicted = self._predict_boundary_dt(inside_state, velocity, max_orb, direction, scan_step)
        if predicted is not None:
            return predicted, False
        outside = self._find_outside_near_prediction(pair_state, aspect_angle, max_orb, inside_state, target, direction, predicted, scan_step)
        if outside is None:
            return inside_state["ts"], True
        state_at = lambda dt: self._state_at(pair_state, aspect_angle, max_orb, dt, target)
        entering = direction < 0
        refined = _refine_boundary(outside, inside_state["ts"], fine_step, state_at, entering)
        return refined, False

    def _exact_for_run(
        self,
        pair_state: dict,
        aspect_angle: float,
        max_orb: float,
        start_at: datetime,
        end_at: datetime,
        target: float,
        scan_step: timedelta,
        fine_step: timedelta,
        run_hits: list[dict],
        velocity: Optional[float] = None,
    ) -> tuple[datetime, Optional[float]]:
        best = min(run_hits, key=lambda hit: hit["orb"])
        if velocity is None:
            velocity = self._velocity_at(pair_state, aspect_angle, best["ts"], target, scan_step)
        exact_guess = best["ts"]
        if velocity is not None and abs(velocity) >= 1e-10:
            candidate = best["ts"] - timedelta(seconds=best["delta"] / velocity)
            if start_at <= candidate <= end_at:
                exact_guess = candidate
        state_at = lambda dt: self._state_at(pair_state, aspect_angle, max_orb, dt, target)
        exact_state = state_at(exact_guess)
        if not exact_state or not exact_state["inside"]:
            exact_state = best
        self.refinement_checks += 1
        return exact_state["ts"], round(exact_state["orb"], 4)

    def _target_for_run(self, run_hits: list[dict]) -> float:
        counts = Counter(hit["target"] for hit in run_hits)
        if counts:
            return counts.most_common(1)[0][0]
        return run_hits[0]["target"]

    def _velocity_from_run_hits(self, run_hits: list[dict]) -> Optional[float]:
        if len(run_hits) < 2:
            return None
        first = run_hits[0]
        last = run_hits[-1]
        seconds = _dt_seconds(last["ts"], first["ts"])
        if abs(seconds) < 1:
            return None
        return _signed_diff(last["delta"], first["delta"]) / seconds

    def _exact_roots_from_run_hits(self, run_hits: list[dict]) -> list[datetime]:
        roots: list[datetime] = []
        ordered = sorted(run_hits, key=lambda hit: hit["ts"])
        for index in range(1, len(ordered)):
            prev = ordered[index - 1]
            current = ordered[index]
            prev_delta = prev["delta"]
            current_delta = current["delta"]
            if abs(prev_delta) < 1e-8:
                roots.append(prev["ts"])
                continue
            if prev_delta * current_delta > 0:
                continue
            total = abs(prev_delta) + abs(current_delta)
            if total <= 0:
                continue
            ratio = abs(prev_delta) / total
            roots.append(prev["ts"] + (current["ts"] - prev["ts"]) * ratio)
        deduped: list[datetime] = []
        for root in roots:
            if not deduped or abs((root - deduped[-1]).total_seconds()) > 3 * 86_400:
                deduped.append(root)
        return deduped

    def _pass_span_for_exact(
        self,
        pair: AspectPair,
        aspect_name: str,
        pair_state: dict,
        aspect_angle: float,
        max_orb: float,
        target: float,
        exact_at: datetime,
        scan_step: timedelta,
        run_index: int,
    ) -> Optional[dict]:
        exact_state = self._state_at(pair_state, aspect_angle, max_orb, exact_at, target)
        if exact_state is None:
            return None
        velocity = self._velocity_at(pair_state, aspect_angle, exact_at, target, scan_step)
        if velocity is None or abs(velocity) < 1e-10:
            start_at = exact_at
            end_at = exact_at
            clipped_start = True
            clipped_end = True
        else:
            offset_seconds = max_orb / abs(velocity)
            start_at = exact_at - timedelta(seconds=offset_seconds)
            end_at = exact_at + timedelta(seconds=offset_seconds)
            clipped_start = False
            clipped_end = False
        return _make_span(
            pair,
            aspect_name,
            start_at,
            exact_at,
            end_at,
            round(exact_state["orb"], 4),
            pair_state["left_sign"](exact_at),
            pair_state["right_sign"](exact_at),
            clipped_start,
            clipped_end,
            [exact_state],
            run_index,
        )

    def _passes_for_continuous_run(
        self,
        pair: AspectPair,
        aspect_name: str,
        pair_state: dict,
        aspect_angle: float,
        max_orb: float,
        target: float,
        scan_step: timedelta,
        run_hits: list[dict],
        base_run_index: int,
    ) -> list[dict]:
        roots = self._exact_roots_from_run_hits(run_hits)
        if len(roots) <= 1:
            return []
        spans = []
        for index, root in enumerate(roots):
            pass_span = self._pass_span_for_exact(
                pair,
                aspect_name,
                pair_state,
                aspect_angle,
                max_orb,
                target,
                root,
                scan_step,
                base_run_index + index,
            )
            if pass_span is not None:
                spans.append(pass_span)
        return spans

    def _make_run_span(
        self,
        pair: AspectPair,
        aspect_name: str,
        pair_state: dict,
        scan_step: timedelta,
        fine_step: timedelta,
        run_hits: list[dict],
        run_start_outside: Optional[dict],
        run_end_outside: Optional[dict],
        run_index: int,
    ) -> list[dict]:
        aspect_angle = ASPECT_ANGLES[_normalize_key(aspect_name)]
        max_orb = DEFAULT_ORBS[_normalize_key(aspect_name)]
        target = self._target_for_run(run_hits)
        state_at = lambda dt: self._state_at(pair_state, aspect_angle, max_orb, dt, target)
        first_inside = state_at(run_hits[0]["ts"]) or run_hits[0]
        last_inside = state_at(run_hits[-1]["ts"]) or run_hits[-1]
        best_inside = min(run_hits, key=lambda hit: hit["orb"])
        run_velocity = self._velocity_from_run_hits(run_hits)
        if run_velocity is None:
            run_velocity = self._velocity_at(pair_state, aspect_angle, best_inside["ts"], target, scan_step)

        start_at, start_clipped = self._refine_predicted_boundary(
            pair_state, aspect_angle, max_orb, first_inside, target, -1, scan_step, fine_step, run_velocity
        )
        if start_clipped and run_start_outside is not None:
            start_at = _refine_boundary(run_start_outside["ts"], first_inside["ts"], fine_step, state_at, True)
            start_clipped = False

        end_at, end_clipped = self._refine_predicted_boundary(
            pair_state, aspect_angle, max_orb, last_inside, target, 1, scan_step, fine_step, run_velocity
        )
        if end_clipped and run_end_outside is not None:
            end_at = _refine_boundary(run_end_outside["ts"], last_inside["ts"], fine_step, state_at, False)
            end_clipped = False

        if end_at < start_at:
            start_at, end_at = end_at, start_at

        exact_at, min_orb = self._exact_for_run(pair_state, aspect_angle, max_orb, start_at, end_at, target, scan_step, fine_step, run_hits, run_velocity)
        span = _make_span(
            pair,
            aspect_name,
            start_at,
            exact_at,
            end_at,
            min_orb,
            pair_state["left_sign"](exact_at),
            pair_state["right_sign"](exact_at),
            start_clipped,
            end_clipped,
            run_hits,
            run_index,
        )
        pass_spans = self._passes_for_continuous_run(
            pair,
            aspect_name,
            pair_state,
            aspect_angle,
            max_orb,
            target,
            scan_step,
            run_hits,
            run_index,
        )
        if len(pass_spans) > 1:
            return [_collapse_pass_group(group) for group in _span_interval_groups(pass_spans)]
        return [_ensure_single_pass(span)]

    def _scan_pair_aspect(self, pair: AspectPair, aspect_name: str, pair_state: dict, run_index: int) -> tuple[list[dict], int]:
        aspect_key = _normalize_key(aspect_name)
        aspect_angle = ASPECT_ANGLES[aspect_key]
        max_orb = DEFAULT_ORBS[aspect_key]
        range_seconds = max((self.end_dt - self.start_dt).total_seconds(), 0)
        scan_step = _kinematic_step_for_points(pair.left_key, pair.right_key, range_seconds)
        fine_step = _fine_step_for_points(pair.left_key, pair.right_key)

        spans: list[dict] = []
        prev: Optional[dict] = None
        run_hits: list[dict] = []
        run_start_outside: Optional[dict] = None

        for dt in _iter_times(self.start_dt, self.end_dt, scan_step):
            current = self._state_at(pair_state, aspect_angle, max_orb, dt)
            if current is None:
                prev = None
                run_hits = []
                run_start_outside = None
                continue
            if current["inside"]:
                if run_hits and current["target"] != run_hits[-1]["target"]:
                    spans.extend(self._make_run_span(pair, aspect_name, pair_state, scan_step, fine_step, run_hits, run_start_outside, prev, run_index))
                    run_index += 1
                    run_hits = []
                    run_start_outside = prev if prev and not prev["inside"] else None
                if not run_hits:
                    run_start_outside = prev if prev and not prev["inside"] else None
                run_hits.append(current)
            elif run_hits:
                spans.extend(self._make_run_span(pair, aspect_name, pair_state, scan_step, fine_step, run_hits, run_start_outside, current, run_index))
                run_index += 1
                run_hits = []
                run_start_outside = None
            prev = current

        if run_hits:
            spans.extend(self._make_run_span(pair, aspect_name, pair_state, scan_step, fine_step, run_hits, run_start_outside, None, run_index))
            run_index += 1

        return spans, run_index


def compute_kinematic_range_aspect_spans(
    transit_base: BirthData,
    cfg: ChartConfig,
    start_dt: datetime,
    end_dt: datetime,
    mode: str = "transit",
    birth: Optional[BirthData] = None,
) -> dict:
    return KinematicAspectSpanCalculator(transit_base, cfg, start_dt, end_dt, mode, birth).compute()
