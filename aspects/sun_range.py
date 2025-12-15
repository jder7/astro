from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import re
from typing import Optional

from schemas import SunYearRange, SunRangeEntry, BirthData, ChartConfig
from utils import ensure_config, build_subject_for_moment


def _normalize_range_id(value: Optional[str], fallback: str) -> str:
    base = (value or "").strip().lower()
    if not base:
        base = fallback
    base = re.sub(r"[^a-z0-9-]+", "_", base)
    base = base.strip("_") or fallback
    return base


def _round_to_minute(dt: datetime) -> datetime:
    return dt.replace(second=0, microsecond=0)


@dataclass
class SunRangeCalculator:
    base: BirthData
    config: Optional[ChartConfig] = None

    def __post_init__(self) -> None:
        self.cfg = ensure_config(self.config)
        self.sun_cfg = self.cfg.model_copy(deep=True)
        # Speed up calculations by limiting to the Sun only.
        self.sun_cfg.active_points = ["Sun"]

    def compute_year_range(self, anchor: datetime, identifier: str, label: Optional[str] = None) -> SunYearRange:
        anchor_data = self._sun_at(anchor)
        anchor_sign = anchor_data.get("sign")
        range_id = _normalize_range_id(identifier, "sun")
        if not anchor_sign:
            return SunYearRange(id=range_id, label=label or identifier.title(), anchor=anchor, entries=[])

        speed_est = self._estimate_speed(anchor, anchor_data)
        start_of_anchor_sign = self._find_sign_start(anchor, anchor_sign, anchor_data, speed_est)

        entries: list[SunRangeEntry] = []
        target_end = anchor + timedelta(days=370)
        current_start = start_of_anchor_sign
        current_sign_data = anchor_data if start_of_anchor_sign <= anchor else self._sun_at(current_start + timedelta(hours=6))
        current_sign = current_sign_data.get("sign") or anchor_sign

        max_entries = 16  # safety cap for a little over a year
        for _ in range(max_entries):
            next_start = self._find_next_sign_start(current_start, current_sign, speed_est)
            if next_start <= current_start:
                next_start = current_start + timedelta(hours=12)

            entry = SunRangeEntry(
                start=_round_to_minute(current_start),
                end=_round_to_minute(next_start),
                sign=current_sign,
                sign_num=current_sign_data.get("sign_num"),
                element=current_sign_data.get("element"),
                quality=current_sign_data.get("quality"),
                emoji=current_sign_data.get("emoji"),
            )

            if entries and entries[-1].sign == entry.sign:
                # Merge adjacent same-sign intervals to avoid rounding duplicates.
                entries[-1].end = entry.end
            else:
                entries.append(entry)

            if next_start >= target_end:
                break
            current_start = entries[-1].end
            current_sign_data = self._sun_at(current_start + timedelta(minutes=30))
            current_sign = current_sign_data.get("sign")
            if not current_sign:
                break

        entries.sort(key=lambda e: e.start)
        return SunYearRange(
            id=range_id,
            label=label or identifier.title(),
            anchor=anchor,
            entries=entries,
        )

    def _sun_at(self, dt: datetime) -> dict:
        subject = build_subject_for_moment(self.base, dt, self.sun_cfg)
        return subject.model_dump(mode="json").get("sun", {}) if subject else {}

    @staticmethod
    def _angular_delta(a: Optional[float], b: Optional[float]) -> Optional[float]:
        if a is None or b is None:
            return None
        delta = (b - a) % 360
        if delta > 180:
            delta -= 360
        return delta

    def _estimate_speed(self, anchor: datetime, anchor_data: dict) -> float:
        probe_dt = anchor + timedelta(days=1)
        probe_data = self._sun_at(probe_dt)
        delta = self._angular_delta(anchor_data.get("abs_pos"), probe_data.get("abs_pos"))
        if delta is not None and delta > 0:
            return max(0.01, min(delta / 24.0, 0.08))
        speed_daily = anchor_data.get("speed")
        if isinstance(speed_daily, (int, float)):
            return max(0.01, min(float(speed_daily) / 24.0, 0.08))
        # Average Sun motion ~0.9856 deg/day -> ~0.041 deg/hour.
        return 0.041

    def _find_sign_start(self, anchor_dt: datetime, anchor_sign: str, anchor_payload: dict, speed_est: float) -> datetime:
        orb = anchor_payload.get("position") or anchor_payload.get("orb") or 0.0
        approx_hours_back = float(orb) / max(speed_est, 0.001)
        approx_start = anchor_dt - timedelta(hours=approx_hours_back)
        probe_dt = approx_start - timedelta(days=3)
        probe_sign = self._sun_at(probe_dt).get("sign")
        back_limit = anchor_dt - timedelta(days=90)
        last_same = anchor_dt
        while probe_sign == anchor_sign and probe_dt > back_limit:
            last_same = probe_dt
            probe_dt -= timedelta(days=3)
            probe_sign = self._sun_at(probe_dt).get("sign")
        if probe_sign == anchor_sign:
            return _round_to_minute(anchor_dt)
        return self._find_boundary(probe_dt, last_same, anchor_sign)

    def _find_next_sign_start(self, start_dt: datetime, current_sign: str, speed_est: float) -> datetime:
        est_duration_hours = 30.0 / max(speed_est, 0.001)
        est_duration_hours = max(480.0, min(est_duration_hours * 1.02, 960.0))
        probe_dt = start_dt + timedelta(hours=est_duration_hours)
        probe_sign = self._sun_at(probe_dt).get("sign")
        step_hours = max(12.0, est_duration_hours * 0.25)
        limit_dt = start_dt + timedelta(days=80)

        last_same = start_dt
        while probe_sign == current_sign and probe_dt < limit_dt:
            last_same = probe_dt
            probe_dt += timedelta(hours=step_hours)
            probe_sign = self._sun_at(probe_dt).get("sign")

        if probe_sign == current_sign:
            probe_dt = limit_dt + timedelta(hours=6)
            probe_sign = self._sun_at(probe_dt).get("sign") or current_sign

        if probe_sign == current_sign:
            return _round_to_minute(probe_dt)

        first_diff = probe_dt
        return self._find_first_difference(last_same, first_diff, current_sign)

    def _find_boundary(self, start_dt: datetime, end_dt: datetime, target_sign: str) -> datetime:
        low = start_dt
        high = end_dt
        for _ in range(64):
            if (high - low) <= timedelta(minutes=1):
                break
            mid = low + (high - low) / 2
            mid_sign = self._sun_at(mid).get("sign")
            if mid_sign == target_sign:
                high = mid
            else:
                low = mid
        return _round_to_minute(high)

    def _find_first_difference(self, low_same: datetime, high_diff: datetime, current_sign: str) -> datetime:
        low = low_same
        high = high_diff
        for _ in range(64):
            if (high - low) <= timedelta(minutes=1):
                break
            mid = low + (high - low) / 2
            mid_sign = self._sun_at(mid).get("sign")
            if mid_sign == current_sign:
                low = mid
            else:
                high = mid
        return _round_to_minute(high)


def compute_sun_year_range(
    base: BirthData,
    config: Optional[ChartConfig],
    anchor: datetime,
    identifier: str,
    label: Optional[str] = None,
) -> SunYearRange:
    calc = SunRangeCalculator(base=base, config=config)
    return calc.compute_year_range(anchor=anchor, identifier=identifier, label=label)
