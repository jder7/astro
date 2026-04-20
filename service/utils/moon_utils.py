from __future__ import annotations

import math
from datetime import timedelta
from typing import Optional

from service.schemas import BirthData, ChartConfig, NextLunation
from service.utils.config import ensure_config
from service.utils.subjects import build_subject_for_moment


class MoonPhaseUtils:
    def __init__(self, base: BirthData, config: Optional[ChartConfig]) -> None:
        self.base = base
        cfg = ensure_config(config)
        self.lunation_cfg = cfg.model_copy(deep=True)
        self.lunation_cfg.active_points = ["Sun", "Moon"]

    @staticmethod
    def _phase_angle_from_payload(payload: dict) -> Optional[float]:
        sun = payload.get("sun") or {}
        moon = payload.get("moon") or {}
        sun_pos = sun.get("abs_pos")
        moon_pos = moon.get("abs_pos")
        if not isinstance(sun_pos, (int, float)) or not isinstance(moon_pos, (int, float)):
            return None
        return (moon_pos - sun_pos) % 360

    @staticmethod
    def phase_name_emoji(phase_angle: float, illumination_pct: Optional[float] = None) -> tuple[str, str]:
        # If illumination is extreme, force New/Full Moon labels.
        if isinstance(illumination_pct, (int, float)):
            if illumination_pct < 1.0:
                return "New Moon", "🌑"
            if illumination_pct > 99.0:
                return "Full Moon", "🌕"

        # 8-phase buckets centered on standard lunar phases (45° segments).
        angle = phase_angle % 360
        if angle < 22.5 or angle >= 337.5:
            return "New Moon", "🌑"
        if angle < 67.5:
            return "Waxing Crescent", "🌒"
        if angle < 112.5:
            return "First Quarter", "🌓"
        if angle < 157.5:
            return "Waxing Gibbous", "🌔"
        if angle < 202.5:
            return "Full Moon", "🌕"
        if angle < 247.5:
            return "Waning Gibbous", "🌖"
        if angle < 292.5:
            return "Last Quarter", "🌗"
        return "Waning Crescent", "🌘"

    def sun_moon_phase(self, dt) -> Optional[float]:
        subject = build_subject_for_moment(self.base, dt, self.lunation_cfg)
        payload = subject.model_dump(mode="json") if subject else {}
        return self._phase_angle_from_payload(payload)

    def compute_next_lunation(self, anchor) -> Optional[NextLunation]:
        phase_now = self.sun_moon_phase(anchor)
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
            probe_phase_raw = self.sun_moon_phase(probe_time)
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
            mid_phase_raw = self.sun_moon_phase(mid)
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

        ts = high.replace(second=0, microsecond=0)
        phase_type = "Full Moon" if (target % 360) == 180 else "New Moon"
        return NextLunation(type=phase_type, timestamp=ts)

    def phase_info(self, dt) -> dict:
        subject = build_subject_for_moment(self.base, dt, self.lunation_cfg)
        payload = subject.model_dump(mode="json") if subject else {}
        lunar = payload.get("lunar_phase") or {}
        phase_name = lunar.get("moon_phase_name") or None
        phase_emoji = lunar.get("moon_emoji") or None
        illumination_pct = None
        phase_angle = self._phase_angle_from_payload(payload)
        if isinstance(phase_angle, (int, float)):
            illumination_pct = round(((1 - math.cos(math.radians(phase_angle))) / 2) * 100, 1)
            computed_name, computed_emoji = self.phase_name_emoji(phase_angle, illumination_pct)
            if illumination_pct < 1.0 or illumination_pct > 99.0:
                phase_name = computed_name
                phase_emoji = computed_emoji
            elif not phase_name or not phase_emoji:
                phase_name = phase_name or computed_name
                phase_emoji = phase_emoji or computed_emoji
        return {
            "phase": phase_name,
            "phase_emoji": phase_emoji,
            "illumination_percentage": illumination_pct,
        }
