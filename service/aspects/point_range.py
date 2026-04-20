from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import re
from typing import Optional

from service.schemas import PointSignRange, PointSignRangeEntry, BirthData, ChartConfig, NextLunation
from service.utils.config import ensure_config
from service.utils.subjects import build_subject_for_moment
from service.utils.moon_utils import MoonPhaseUtils


HOURS_PER_DAY = 24.0
ZODIAC_ORDER = ["Ari", "Tau", "Gem", "Can", "Leo", "Vir", "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis"]
FULL_TO_ABBREV = {
    "aries": "Ari",
    "taurus": "Tau",
    "gemini": "Gem",
    "cancer": "Can",
    "leo": "Leo",
    "virgo": "Vir",
    "libra": "Lib",
    "scorpio": "Sco",
    "sagittarius": "Sag",
    "capricorn": "Cap",
    "aquarius": "Aqu",
    "pisces": "Pis",
}


def _normalize_point_key(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "value"):
        value = value.value
    return str(value).strip()


def _normalize_range_id(value: Optional[str], fallback: str) -> str:
    base = (value or "").strip().lower()
    if not base:
        base = fallback
    base = re.sub(r"[^a-z0-9-]+", "_", base)
    base = base.strip("_") or fallback
    return base


def _round_to_minute(dt: datetime) -> datetime:
    return dt.replace(second=0, microsecond=0)


def _point_label_from_key(key: str) -> str:
    if not key:
        return "Point"
    return " ".join(part.capitalize() for part in str(key).replace("-", "_").split("_") if part)


def _normalize_sign(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    lower = raw.lower()
    if lower in FULL_TO_ABBREV:
        return FULL_TO_ABBREV[lower]
    if len(raw) == 3:
        return raw.title()
    return raw.title()


@dataclass
class PointRangeCalculator:
    base: BirthData
    point_key: str
    config: Optional[ChartConfig] = None

    def __post_init__(self) -> None:
        self.cfg = ensure_config(self.config)
        self.point_key = _normalize_point_key(self.point_key)
        self.point_key_norm = self.point_key.lower()
        self.point_cfg = self.cfg.model_copy(deep=True)
        # Speed up calculations by limiting to the point only.
        self.point_cfg.active_points = [self.point_key]
        self.phase_utils = MoonPhaseUtils(self.base, self.cfg) if self.point_key_norm == "moon" else None

    def compute_sign_range(
        self,
        anchor: datetime,
        identifier: str,
        label: Optional[str] = None,
        entries_count: int = 12,
    ) -> PointSignRange:
        anchor_data = self._point_at(anchor)
        anchor_sign = anchor_data.get("sign")
        anchor_sign_norm = _normalize_sign(anchor_sign)
        point_label = anchor_data.get("name") or _point_label_from_key(self.point_key)
        range_id = _normalize_range_id(f"{identifier}-{self.point_key_norm}", self.point_key_norm or "point")
        if not anchor_sign or not anchor_sign_norm:
            return PointSignRange(
                id=range_id,
                label=label or identifier.title(),
                anchor=anchor,
                point_key=self.point_key_norm or self.point_key,
                point_label=point_label,
                entries=[],
            )

        speed_est = self._estimate_speed(anchor, anchor_data)
        start_of_anchor_sign = self._find_sign_start(anchor, anchor_sign, anchor_data, speed_est)

        entries: list[PointSignRangeEntry] = []
        next_lunation: Optional[NextLunation] = None
        current_start = start_of_anchor_sign
        current_sign_data = anchor_data if start_of_anchor_sign <= anchor else self._point_at(current_start + timedelta(hours=6))
        current_sign = current_sign_data.get("sign") or anchor_sign
        current_sign_norm = _normalize_sign(current_sign)
        if not current_sign_norm:
            current_sign_norm = anchor_sign_norm

        expected = []
        if anchor_sign_norm in ZODIAC_ORDER:
            start_idx = ZODIAC_ORDER.index(anchor_sign_norm)
            expected = [ZODIAC_ORDER[(start_idx + i) % 12] for i in range(12)]
        else:
            expected = [anchor_sign_norm]
        expected_idx = 1
        target_count = max(1, len(expected))

        max_entries = max(120, int(entries_count) * 30)
        iterations = 0
        while iterations < max_entries:
            next_start = self._find_next_sign_start(current_start, current_sign, speed_est)
            if next_start <= current_start:
                next_start = current_start + timedelta(hours=12)

            phase_info = self.phase_utils.phase_info(current_start) if self.phase_utils else {}
            entry = PointSignRangeEntry(
                start=_round_to_minute(current_start),
                end=_round_to_minute(next_start),
                sign=current_sign,
                sign_num=current_sign_data.get("sign_num"),
                element=current_sign_data.get("element"),
                quality=current_sign_data.get("quality"),
                emoji=current_sign_data.get("emoji"),
                phase=phase_info.get("phase"),
                phase_emoji=phase_info.get("phase_emoji"),
                illumination_percentage=phase_info.get("illumination_percentage"),
            )

            if entries and entries[-1].sign == entry.sign:
                # Merge adjacent same-sign intervals to avoid rounding duplicates.
                entries[-1].end = entry.end
            else:
                entries.append(entry)

            current_sign_norm = _normalize_sign(entry.sign) or current_sign_norm
            if expected_idx < target_count and current_sign_norm == expected[expected_idx]:
                expected_idx += 1
                if expected_idx >= target_count:
                    break

            current_start = entries[-1].end
            current_sign_data = self._point_at(current_start + timedelta(minutes=30))
            current_sign = current_sign_data.get("sign")
            if not current_sign:
                break
            iterations += 1

        entries.sort(key=lambda e: e.start)
        if self.phase_utils:
            next_lunation = self.phase_utils.compute_next_lunation(anchor)
        return PointSignRange(
            id=range_id,
            label=label or identifier.title(),
            anchor=anchor,
            point_key=self.point_key_norm or self.point_key,
            point_label=point_label,
            entries=entries,
            next_lunation=next_lunation,
        )

    def compute_timeline(
        self,
        start: datetime,
        end: datetime,
    ) -> list[PointSignRangeEntry]:
        """
        Compute contiguous sign intervals for a point between start (inclusive)
        and end (exclusive).
        """
        if start >= end:
            return []

        start_data = self._point_at(start)
        current_sign = start_data.get("sign")
        if not current_sign:
            return []

        speed_est = self._estimate_speed(start, start_data)
        entries: list[PointSignRangeEntry] = []
        cursor = start
        current_data = start_data
        guard = 0
        max_segments = 4096

        while cursor < end and guard < max_segments:
            if not current_sign:
                break
            next_start = self._find_next_sign_start(cursor, current_sign, speed_est)
            if next_start <= cursor:
                next_start = cursor + timedelta(minutes=1)
            segment_end = min(next_start, end)
            if segment_end <= cursor:
                break

            phase_info = self.phase_utils.phase_info(cursor) if self.phase_utils else {}
            entry = PointSignRangeEntry(
                start=_round_to_minute(cursor),
                end=_round_to_minute(segment_end),
                sign=current_sign,
                sign_num=current_data.get("sign_num"),
                element=current_data.get("element"),
                quality=current_data.get("quality"),
                emoji=current_data.get("emoji"),
                phase=phase_info.get("phase"),
                phase_emoji=phase_info.get("phase_emoji"),
                illumination_percentage=phase_info.get("illumination_percentage"),
            )

            if entry.start < entry.end:
                if entries and entries[-1].sign == entry.sign and entries[-1].end >= entry.start:
                    entries[-1].end = entry.end
                else:
                    entries.append(entry)

            cursor = segment_end
            if cursor >= end:
                break
            probe_dt = cursor + timedelta(minutes=1)
            if probe_dt > end:
                probe_dt = cursor
            current_data = self._point_at(probe_dt)
            current_sign = current_data.get("sign")
            guard += 1

        return entries

    def _point_at(self, dt: datetime) -> dict:
        subject = build_subject_for_moment(self.base, dt, self.point_cfg)
        payload = subject.model_dump(mode="json") if subject else {}
        return payload.get(self.point_key_norm) or payload.get(self.point_key) or {}

    @staticmethod
    def _angular_delta(a: Optional[float], b: Optional[float]) -> Optional[float]:
        if a is None or b is None:
            return None
        delta = (b - a) % 360
        if delta > 180:
            delta -= 360
        return delta

    def _estimate_speed(self, anchor: datetime, anchor_data: dict) -> float:
        # Attempt a few probe windows to estimate degrees per hour.
        for probe_hours in (6, 24, 168):
            probe_dt = anchor + timedelta(hours=probe_hours)
            probe_data = self._point_at(probe_dt)
            delta = self._angular_delta(anchor_data.get("abs_pos"), probe_data.get("abs_pos"))
            if delta is not None and delta != 0:
                return max(0.0001, min(abs(delta) / float(probe_hours), 5.0))

        speed_daily = anchor_data.get("speed")
        if isinstance(speed_daily, (int, float)) and speed_daily != 0:
            return max(0.0001, min(abs(float(speed_daily)) / HOURS_PER_DAY, 5.0))

        # Fallback to a conservative default (deg/hour).
        return 0.01

    def _find_sign_start(self, anchor_dt: datetime, anchor_sign: str, anchor_payload: dict, speed_est: float) -> datetime:
        orb = anchor_payload.get("position") or anchor_payload.get("orb") or 0.0
        est_duration_hours = 30.0 / max(speed_est, 0.0001)
        approx_hours_back = float(orb) / max(speed_est, 0.0001)
        approx_start = anchor_dt - timedelta(hours=approx_hours_back)
        step_hours = max(12.0, est_duration_hours * 0.25)
        probe_dt = approx_start - timedelta(hours=step_hours)
        back_limit = anchor_dt - timedelta(hours=est_duration_hours * 2.5)
        last_same = anchor_dt
        probe_sign = self._point_at(probe_dt).get("sign")
        steps = 0
        while probe_sign == anchor_sign and probe_dt > back_limit and steps < 60:
            last_same = probe_dt
            probe_dt -= timedelta(hours=step_hours)
            probe_sign = self._point_at(probe_dt).get("sign")
            steps += 1
        if probe_sign == anchor_sign:
            return _round_to_minute(anchor_dt)
        return self._find_boundary(probe_dt, last_same, anchor_sign)

    def _find_next_sign_start(self, start_dt: datetime, current_sign: str, speed_est: float) -> datetime:
        est_duration_hours = 30.0 / max(speed_est, 0.0001)
        probe_dt = start_dt + timedelta(hours=est_duration_hours)
        probe_sign = self._point_at(probe_dt).get("sign")
        step_hours = max(12.0, est_duration_hours * 0.25)
        limit_dt = start_dt + timedelta(hours=est_duration_hours * 3.0)

        last_same = start_dt
        steps = 0
        while probe_sign == current_sign and probe_dt < limit_dt and steps < 60:
            last_same = probe_dt
            probe_dt += timedelta(hours=step_hours)
            probe_sign = self._point_at(probe_dt).get("sign")
            steps += 1

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
            mid_sign = self._point_at(mid).get("sign")
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
            mid_sign = self._point_at(mid).get("sign")
            if mid_sign == current_sign:
                low = mid
            else:
                high = mid
        return _round_to_minute(high)


def compute_point_sign_range(
    base: BirthData,
    config: Optional[ChartConfig],
    anchor: datetime,
    point_key: str,
    identifier: str,
    label: Optional[str] = None,
    entries_count: int = 12,
) -> PointSignRange:
    calc = PointRangeCalculator(base=base, point_key=point_key, config=config)
    return calc.compute_sign_range(
        anchor=anchor,
        identifier=identifier,
        label=label,
        entries_count=entries_count,
    )


def compute_point_sign_timeline(
    base: BirthData,
    config: Optional[ChartConfig],
    start: datetime,
    end: datetime,
    point_key: str,
) -> list[PointSignRangeEntry]:
    calc = PointRangeCalculator(base=base, point_key=point_key, config=config)
    return calc.compute_timeline(start=start, end=end)
