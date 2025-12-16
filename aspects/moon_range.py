from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import re
from typing import Optional, Literal

from schemas import MoonMonthRange, MoonRangeEntry, BirthData, ChartConfig, NextLunation
from utils import ensure_config, build_subject_for_moment


def _normalize_range_id(value: Optional[str], fallback: str) -> str:
    base = (value or "").strip().lower()
    if not base:
        base = fallback
    # Allow hyphens to remain for readability (e.g., "natal-moon").
    base = re.sub(r"[^a-z0-9-]+", "_", base)
    base = base.strip("_") or fallback
    return base


def _round_to_minute(dt: datetime) -> datetime:
    return dt.replace(second=0, microsecond=0)


@dataclass
class MoonRangeCalculator:
    base: BirthData
    config: Optional[ChartConfig] = None

    def __post_init__(self) -> None:
        self.cfg = ensure_config(self.config)
        self.moon_cfg = self.cfg.model_copy(deep=True)
        self.moon_cfg.active_points = ["Moon"]
        self.lunation_cfg = self.cfg.model_copy(deep=True)
        self.lunation_cfg.active_points = ["Sun", "Moon"]

    def compute_month_range(self, anchor: datetime, identifier: str, label: Optional[str] = None) -> MoonMonthRange:
        anchor_data = self._moon_at(anchor)
        anchor_sign = anchor_data.get("sign")
        range_id = _normalize_range_id(identifier, "moon")
        if not anchor_sign:
            return MoonMonthRange(id=range_id, label=label or identifier.title(), anchor=anchor, entries=[])

        speed_est = self._estimate_speed(anchor, anchor_data)
        start_of_anchor_sign = self._find_sign_start(anchor, anchor_sign, anchor_data, speed_est)

        entries: list[MoonRangeEntry] = []
        target_end = anchor + timedelta(days=32)
        current_start = start_of_anchor_sign
        current_sign_data = anchor_data if start_of_anchor_sign <= anchor else self._moon_at(current_start + timedelta(hours=1))
        current_sign = current_sign_data.get("sign") or anchor_sign

        max_entries = 60  # safety cap for month-long sweep
        for _ in range(max_entries):
            next_start = self._find_next_sign_start(current_start, current_sign, speed_est)
            if next_start <= current_start:
                next_start = current_start + timedelta(hours=1)

            entry = MoonRangeEntry(
                start=_round_to_minute(current_start),
                end=_round_to_minute(next_start),
                sign=current_sign,
                sign_num=current_sign_data.get("sign_num"),
                element=current_sign_data.get("element"),
                quality=current_sign_data.get("quality"),
                emoji=current_sign_data.get("emoji"),
            )

            if entries and entries[-1].sign == entry.sign:
                # Merge duplicate segments when rounding yields adjacent intervals in the same sign.
                entries[-1].end = entry.end
            else:
                entries.append(entry)

            if next_start >= target_end:
                break
            current_start = entries[-1].end
            current_sign_data = self._moon_at(current_start + timedelta(minutes=30))
            current_sign = current_sign_data.get("sign")
            if not current_sign:
                break

        entries.sort(key=lambda e: e.start)
        next_lunation = self._compute_next_lunation(anchor)
        return MoonMonthRange(
            id=range_id,
            label=label or identifier.title(),
            anchor=anchor,
            entries=entries,
            next_lunation=next_lunation,
        )

    def _moon_at(self, dt: datetime) -> dict:
        subject = build_subject_for_moment(self.base, dt, self.moon_cfg)
        return subject.model_dump(mode="json").get("moon", {}) if subject else {}

    @staticmethod
    def _angular_delta(a: Optional[float], b: Optional[float]) -> Optional[float]:
        if a is None or b is None:
            return None
        delta = (b - a) % 360
        if delta > 180:
            delta -= 360
        return delta

    def _estimate_speed(self, anchor: datetime, anchor_data: dict) -> float:
        probe_dt = anchor + timedelta(hours=6)
        probe_data = self._moon_at(probe_dt)
        delta = self._angular_delta(anchor_data.get("abs_pos"), probe_data.get("abs_pos"))
        if delta is not None and delta > 0:
            return max(0.15, min(delta / 6.0, 2.5))
        speed_daily = anchor_data.get("speed")
        if isinstance(speed_daily, (int, float)):
            return max(0.1, min(speed_daily / 24.0, 2.5))
        return 0.55

    def _find_sign_start(self, anchor_dt: datetime, anchor_sign: str, anchor_payload: dict, speed_est: float) -> datetime:
        orb = anchor_payload.get("position") or anchor_payload.get("orb") or 0.0
        approx_hours_back = float(orb) / max(speed_est, 0.01)
        approx_start = anchor_dt - timedelta(hours=approx_hours_back)
        probe_dt = approx_start - timedelta(hours=6)
        probe_sign = self._moon_at(probe_dt).get("sign")
        back_limit = anchor_dt - timedelta(days=4)
        last_same = anchor_dt
        while probe_sign == anchor_sign and probe_dt > back_limit:
            last_same = probe_dt
            probe_dt -= timedelta(hours=6)
            probe_sign = self._moon_at(probe_dt).get("sign")
        if probe_sign == anchor_sign:
            return _round_to_minute(anchor_dt)
        return self._find_boundary(probe_dt, last_same, anchor_sign)

    def _find_next_sign_start(self, start_dt: datetime, current_sign: str, speed_est: float) -> datetime:
        est_duration_hours = 30.0 / max(speed_est, 0.01)
        est_duration_hours = max(18.0, min(est_duration_hours * 1.05, 84.0))
        probe_dt = start_dt + timedelta(hours=est_duration_hours)
        probe_sign = self._moon_at(probe_dt).get("sign")
        step_hours = max(4.0, est_duration_hours * 0.35)
        limit_dt = start_dt + timedelta(days=6)

        last_same = start_dt
        while probe_sign == current_sign and probe_dt < limit_dt:
            last_same = probe_dt
            probe_dt += timedelta(hours=step_hours)
            probe_sign = self._moon_at(probe_dt).get("sign")

        if probe_sign == current_sign:
            probe_dt = limit_dt + timedelta(hours=2)
            probe_sign = self._moon_at(probe_dt).get("sign") or current_sign

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
            mid_sign = self._moon_at(mid).get("sign")
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
            mid_sign = self._moon_at(mid).get("sign")
            if mid_sign == current_sign:
                low = mid
            else:
                high = mid
        return _round_to_minute(high)

    def _sun_moon_phase(self, dt: datetime) -> Optional[float]:
        subject = build_subject_for_moment(self.base, dt, self.lunation_cfg)
        payload = subject.model_dump(mode="json") if subject else {}
        sun = payload.get("sun") or {}
        moon = payload.get("moon") or {}
        sun_pos = sun.get("abs_pos")
        moon_pos = moon.get("abs_pos")
        if not isinstance(sun_pos, (int, float)) or not isinstance(moon_pos, (int, float)):
            return None
        return (moon_pos - sun_pos) % 360

    def _compute_next_lunation(self, anchor: datetime) -> Optional[NextLunation]:
        phase_now = self._sun_moon_phase(anchor)
        if phase_now is None:
            return None

        # Determine target phase (Full at 180°, New at 360° wrap).
        target = 180.0 if phase_now < 180.0 else 360.0
        if target < phase_now:
            target += 360.0

        step = timedelta(hours=6)
        prev_time = anchor
        prev_phase = phase_now
        bracket = None

        for _ in range(80):
            probe_time = prev_time + step
            probe_phase_raw = self._sun_moon_phase(probe_time)
            if probe_phase_raw is None:
                prev_time = probe_time
                continue
            probe_phase = probe_phase_raw
            while probe_phase < prev_phase:
                probe_phase += 360.0
            if probe_phase >= target:
                bracket = (prev_time, probe_time, prev_phase, probe_phase)
                break
            prev_time = probe_time
            prev_phase = probe_phase

        if bracket is None:
            return None

        low, high, low_phase, high_phase = bracket
        for _ in range(80):
            if (high - low) <= timedelta(minutes=1):
                break
            mid = low + (high - low) / 2
            mid_phase_raw = self._sun_moon_phase(mid)
            if mid_phase_raw is None:
                high = mid
                continue
            mid_phase = mid_phase_raw
            while mid_phase < low_phase:
                mid_phase += 360.0
            if mid_phase >= target:
                high = mid
                high_phase = mid_phase
            else:
                low = mid
                low_phase = mid_phase

        ts = _round_to_minute(high)
        phase_type: Literal["Full Moon", "New Moon"] = "Full Moon" if (target % 360) == 180 else "New Moon"
        return NextLunation(type=phase_type, timestamp=ts)


def compute_moon_month_range(
    base: BirthData,
    config: Optional[ChartConfig],
    anchor: datetime,
    identifier: str,
    label: Optional[str] = None,
) -> MoonMonthRange:
    calc = MoonRangeCalculator(base=base, config=config)
    return calc.compute_month_range(anchor=anchor, identifier=identifier, label=label)
