from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import re
from typing import Optional

from schemas import AscendantDayRange, AscendantRangeEntry, BirthData, ChartConfig
from utils import ensure_config, build_subject_for_moment


def _normalize_range_id(value: Optional[str], fallback: str) -> str:
    base = (value or "").strip().lower()
    if not base:
        base = fallback
    base = re.sub(r"[^a-z0-9]+", "_", base)
    base = base.strip("_") or fallback
    return base


def _round_to_minute(dt: datetime) -> datetime:
    return dt.replace(second=0, microsecond=0)


@dataclass
class AscendantRangeCalculator:
    base: BirthData
    config: Optional[ChartConfig] = None

    def __post_init__(self) -> None:
        self.cfg = ensure_config(self.config)
        self.asc_cfg = self.cfg.model_copy(deep=True)
        self.asc_cfg.active_points = ["Ascendant"]

    def compute_day_range(self, anchor: datetime, identifier: str, label: Optional[str] = None) -> AscendantDayRange:
        anchor_data = self._asc_at(anchor)
        anchor_sign = anchor_data.get("sign")
        if not anchor_sign:
            range_id = _normalize_range_id(identifier, "ascendant")
            return AscendantDayRange(id=range_id, label=label or identifier.title(), anchor=anchor, entries=[])

        speed_est = self._estimate_speed(anchor, anchor_data)
        start_of_anchor_sign = self._find_sign_start(anchor, anchor_sign, anchor_data, speed_est)

        entries: list[AscendantRangeEntry] = []
        target_end = anchor + timedelta(hours=24)
        current_start = start_of_anchor_sign
        current_sign_data = anchor_data if start_of_anchor_sign <= anchor else self._asc_at(current_start + timedelta(minutes=1))
        current_sign = current_sign_data.get("sign") or anchor_sign

        max_entries = 14  # safety cap
        for _ in range(max_entries):
            next_start = self._find_next_sign_start(current_start, current_sign, speed_est)
            if next_start <= current_start:
                next_start = current_start + timedelta(minutes=1)

            entry = AscendantRangeEntry(
                timestamp=_round_to_minute(current_start),
                end=_round_to_minute(next_start),
                sign=current_sign,
                sign_num=current_sign_data.get("sign_num"),
                element=current_sign_data.get("element"),
                quality=current_sign_data.get("quality"),
                emoji=current_sign_data.get("emoji"),
            )
            entries.append(entry)

            if next_start >= target_end:
                break
            current_start = next_start
            current_sign_data = self._asc_at(current_start + timedelta(seconds=30))
            current_sign = current_sign_data.get("sign")
            if not current_sign:
                break

        range_id = _normalize_range_id(identifier, "ascendant")
        entries.sort(key=lambda e: e.timestamp)
        return AscendantDayRange(
            id=range_id,
            label=label or identifier.title(),
            anchor=anchor,
            entries=entries,
        )

    def _asc_at(self, dt: datetime) -> dict:
        subject = build_subject_for_moment(self.base, dt, self.asc_cfg)
        return subject.model_dump(mode="json").get("ascendant", {}) if subject else {}

    @staticmethod
    def _angular_delta(a: Optional[float], b: Optional[float]) -> Optional[float]:
        if a is None or b is None:
            return None
        delta = (b - a) % 360
        if delta > 180:
            delta -= 360
        return delta

    def _estimate_speed(self, anchor: datetime, anchor_data: dict) -> float:
        probe_dt = anchor + timedelta(minutes=10)
        probe_data = self._asc_at(probe_dt)
        delta = self._angular_delta(anchor_data.get("abs_pos"), probe_data.get("abs_pos"))
        if delta is not None and delta > 0:
            return max(0.05, min(delta / 10.0, 1.5))
        return 0.25

    def _find_sign_start(self, anchor_dt: datetime, anchor_sign: str, anchor_payload: dict, speed_est: float) -> datetime:
        orb = anchor_payload.get("position") or anchor_payload.get("orb") or 0.0
        approx_minutes_back = float(orb) / max(speed_est, 0.01)
        approx_start = anchor_dt - timedelta(minutes=approx_minutes_back)
        probe_dt = approx_start - timedelta(minutes=30)
        probe_sign = self._asc_at(probe_dt).get("sign")
        back_limit = anchor_dt - timedelta(hours=6)
        while probe_sign == anchor_sign and probe_dt > back_limit:
            probe_dt -= timedelta(minutes=30)
            probe_sign = self._asc_at(probe_dt).get("sign")
        if probe_sign == anchor_sign:
            return _round_to_minute(anchor_dt)
        return self._find_boundary(probe_dt, anchor_dt, anchor_sign)

    def _find_next_sign_start(self, start_dt: datetime, current_sign: str, speed_est: float) -> datetime:
        est_duration_minutes = 30.0 / max(speed_est, 0.01)
        est_duration_minutes = max(60.0, min(est_duration_minutes * 1.05, 180.0))
        probe_dt = start_dt + timedelta(minutes=est_duration_minutes)
        probe_sign = self._asc_at(probe_dt).get("sign")
        step_minutes = max(15.0, est_duration_minutes * 0.4)
        limit_dt = start_dt + timedelta(hours=6)

        while probe_sign == current_sign and probe_dt < limit_dt:
            probe_dt += timedelta(minutes=step_minutes)
            probe_sign = self._asc_at(probe_dt).get("sign")

        if probe_sign == current_sign:
            probe_dt = limit_dt + timedelta(minutes=15)
            probe_sign = self._asc_at(probe_dt).get("sign") or current_sign

        if probe_sign == current_sign:
            return _round_to_minute(probe_dt)

        target_sign = probe_sign or current_sign
        if target_sign == current_sign:
            return _round_to_minute(probe_dt)

        return self._find_boundary(start_dt, probe_dt, target_sign)

    def _find_boundary(self, start_dt: datetime, end_dt: datetime, target_sign: str) -> datetime:
        low = start_dt
        high = end_dt
        for _ in range(32):
            if (high - low) <= timedelta(minutes=1):
                break
            mid = low + (high - low) / 2
            mid_sign = self._asc_at(mid).get("sign")
            if mid_sign == target_sign:
                high = mid
            else:
                low = mid
        return _round_to_minute(high)


def compute_ascendant_day_range(
    base: BirthData,
    config: Optional[ChartConfig],
    anchor: datetime,
    identifier: str,
    label: Optional[str] = None,
) -> AscendantDayRange:
    calc = AscendantRangeCalculator(base=base, config=config)
    return calc.compute_day_range(anchor=anchor, identifier=identifier, label=label)

