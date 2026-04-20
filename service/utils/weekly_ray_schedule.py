from __future__ import annotations

from datetime import datetime, timedelta
import os
from pathlib import Path
import shutil
import tempfile

from reportlab.lib import colors  # type: ignore
from reportlab.lib.pagesizes import A4, landscape  # type: ignore
from reportlab.pdfbase import pdfmetrics  # type: ignore
from reportlab.pdfbase.ttfonts import TTFont  # type: ignore
from reportlab.pdfgen import canvas  # type: ignore

from service.aspects.point_range import compute_point_sign_timeline
from service.enums import Mode
from service.schemas import (
    BirthData,
    WeeklyRayScheduleRequest,
    WeeklyRayScheduleResponse,
    WeeklyScheduleCell,
    WeeklyScheduleComponent,
    WeeklyScheduleDay,
    WeeklyScheduleRow,
    WeeklyScheduleSegment,
    WeeklyScheduleWeekMeta,
)
from service.utils.moon_utils import MoonPhaseUtils
from .config import ensure_config
from .ranges import to_local_datetime

DAY_RULERS = {
    0: "sun",
    1: "moon",
    2: "mars",
    3: "mercury",
    4: "jupiter",
    5: "venus",
    6: "saturn",
}

POINT_LABELS = {
    "sun": "Sun",
    "moon": "Moon",
    "mercury": "Mercury",
    "venus": "Venus",
    "mars": "Mars",
    "jupiter": "Jupiter",
    "saturn": "Saturn",
    "ascendant": "Ascendant",
}

POINT_ICONS = {
    "sun": "☉",
    "moon": "☾",
    "mercury": "☿",
    "venus": "♀",
    "mars": "♂",
    "jupiter": "♃",
    "saturn": "♄",
    "ascendant": "↗",
}

ELEMENT_COLORS = {
    "Fire": "#fb7185",
    "Earth": "#eab308",
    "Air": "#34d399",
    "Water": "#60a5fa",
}

RAY_COLOR_HEX = {
    1: "#ef4444",
    2: "#1e3a8a",
    3: "#22c55e",
    4: "#facc15",
    5: "#fb923c",
    6: "#22d3ee",
    7: "#a78bfa",
}

SIGN_RAYS = {
    "aries": [1, 7],
    "taurus": [4],
    "gemini": [2],
    "cancer": [3, 7],
    "leo": [1, 5],
    "virgo": [2, 7],
    "libra": [3],
    "scorpio": [4],
    "sagittarius": [4, 5, 6],
    "capricorn": [1, 3, 7],
    "aquarius": [5],
    "pisces": [2, 6],
}

SIGN_ABBREV_TO_NAME = {
    "ari": "Aries",
    "tau": "Taurus",
    "gem": "Gemini",
    "can": "Cancer",
    "leo": "Leo",
    "vir": "Virgo",
    "lib": "Libra",
    "sco": "Scorpio",
    "sag": "Sagittarius",
    "cap": "Capricorn",
    "aqu": "Aquarius",
    "pis": "Pisces",
}

SIGN_SYMBOLS = {
    "aries": "♈︎",
    "taurus": "♉︎",
    "gemini": "♊︎",
    "cancer": "♋︎",
    "leo": "♌︎",
    "virgo": "♍︎",
    "libra": "♎︎",
    "scorpio": "♏︎",
    "sagittarius": "♐︎",
    "capricorn": "♑︎",
    "aquarius": "♒︎",
    "pisces": "♓︎",
    "ari": "♈︎",
    "tau": "♉︎",
    "gem": "♊︎",
    "can": "♋︎",
    "leo": "♌︎",
    "vir": "♍︎",
    "lib": "♎︎",
    "sco": "♏︎",
    "sag": "♐︎",
    "cap": "♑︎",
    "aqu": "♒︎",
    "pis": "♓︎",
}

SIGIL_DEBUG_ENABLED = os.getenv("WEEKLY_SIGIL_DEBUG", "").strip().lower() in {"1", "true", "yes", "on"}


def _moment_to_birth(moment) -> BirthData:
    return BirthData(
        name="Transit",
        year=moment.year,
        month=moment.month,
        day=moment.day,
        hour=moment.hour,
        minute=moment.minute,
        lng=moment.lng,
        lat=moment.lat,
        tz_str=moment.tz_str,
        city=moment.city,
        nation=moment.nation,
    )


def _to_iso_week_window(anchor: datetime) -> tuple[datetime, datetime]:
    week_start = (anchor - timedelta(days=anchor.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    return week_start, week_start + timedelta(days=7)


def _normalize_sign_name(value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    low = raw.lower()
    if low in SIGN_ABBREV_TO_NAME:
        return SIGN_ABBREV_TO_NAME[low]
    if low in SIGN_RAYS:
        return raw.title()
    return raw.title()


def _sign_symbol(sign: str | None) -> str:
    key = str(sign or "").strip().lower()
    return SIGN_SYMBOLS.get(key, "")


def _segment_color(sign: str | None, element: str | None) -> tuple[str, list[str]]:
    sign_name = _normalize_sign_name(sign).lower()
    rays = SIGN_RAYS.get(sign_name, [])
    ray_colors = [RAY_COLOR_HEX[r] for r in rays if r in RAY_COLOR_HEX]
    if ray_colors:
        return ray_colors[0], ray_colors
    if element and element in ELEMENT_COLORS:
        return ELEMENT_COLORS[element], []
    return "#94a3b8", []


def _intersect_segments(
    segments: list[WeeklyScheduleSegment],
    start: datetime,
    end: datetime,
) -> list[WeeklyScheduleSegment]:
    if start >= end:
        return []
    total = (end - start).total_seconds()
    out: list[WeeklyScheduleSegment] = []
    for segment in segments:
        seg_start = max(start, segment.start)
        seg_end = min(end, segment.end)
        if seg_start >= seg_end:
            continue
        ratio = (seg_end - seg_start).total_seconds() / total if total > 0 else 0.0
        out.append(
            WeeklyScheduleSegment(
                start=seg_start,
                end=seg_end,
                ratio=ratio,
                point_key=segment.point_key,
                label=segment.label,
                sign=segment.sign,
                sign_icon=segment.sign_icon,
                element=segment.element,
                color=segment.color,
                ray_colors=list(segment.ray_colors or []),
            )
        )
    return out


def _entries_to_segments(
    entries: list,
    start: datetime,
    end: datetime,
    point_key: str,
    label: str,
) -> list[WeeklyScheduleSegment]:
    if start >= end:
        return []
    total = (end - start).total_seconds()
    segments: list[WeeklyScheduleSegment] = []
    for entry in entries:
        seg_start = max(start, entry.start)
        seg_end = min(end, entry.end)
        if seg_start >= seg_end:
            continue
        ratio = (seg_end - seg_start).total_seconds() / total if total > 0 else 0.0
        color, ray_colors = _segment_color(entry.sign, entry.element)
        segments.append(
            WeeklyScheduleSegment(
                start=seg_start,
                end=seg_end,
                ratio=ratio,
                point_key=point_key,
                label=label,
                sign=_normalize_sign_name(entry.sign),
                sign_icon=_sign_symbol(entry.sign),
                element=entry.element,
                color=color,
                ray_colors=ray_colors,
                phase=getattr(entry, "phase", None),
                illumination_percentage=getattr(entry, "illumination_percentage", None),
            )
        )
    return segments


def _first_component(segments: list[WeeklyScheduleSegment], point_key: str, label: str) -> WeeklyScheduleComponent | None:
    if not segments:
        return None
    # Use the dominant segment for this hour slice so short boundary fragments do not
    # override the effective component used for sigil/tooltips.
    first = max(segments, key=lambda segment: (segment.ratio, -segment.start.timestamp()))
    return WeeklyScheduleComponent(
        point_key=point_key,
        label=label,
        sign=first.sign,
        sign_icon=first.sign_icon,
        element=first.element,
        color=first.color,
        ray_colors=list(first.ray_colors or []),
        start=first.start,
        end=first.end,
    )


def _compute_point_segments(
    *,
    base: BirthData,
    cfg,
    start: datetime,
    end: datetime,
    point_key: str,
) -> list[WeeklyScheduleSegment]:
    entries = compute_point_sign_timeline(base, cfg, start, end, point_key=point_key)
    return _entries_to_segments(entries, start, end, point_key=point_key, label=POINT_LABELS.get(point_key, point_key.title()))


def _compute_day_ruler_segments_for_day(
    *,
    base: BirthData,
    cfg,
    day_start: datetime,
    day_end: datetime,
    ruler_key: str,
) -> tuple[list[WeeklyScheduleSegment], list[WeeklyScheduleSegment]]:
    entries = compute_point_sign_timeline(base, cfg, day_start, day_end, point_key=ruler_key)
    ruler_segments = _entries_to_segments(
        entries,
        day_start,
        day_end,
        point_key=ruler_key,
        label=f"{POINT_LABELS.get(ruler_key, ruler_key.title())} day ruler",
    )
    aura_segments = [segment.model_copy(update={"label": "Day aura"}) for segment in ruler_segments]
    return ruler_segments, aura_segments


def _compute_day_moon_state(
    phase_utils: MoonPhaseUtils,
    sample_dt: datetime,
) -> tuple[str | None, float | None]:
    try:
        phase_info = phase_utils.phase_info(sample_dt) or {}
    except Exception:
        return None, None
    phase = str(phase_info.get("phase") or "").strip() or None
    illumination_raw = phase_info.get("illumination_percentage")
    try:
        illumination = float(illumination_raw) if illumination_raw is not None else None
    except (TypeError, ValueError):
        illumination = None
    return phase, illumination


def _build_hourly_rows(
    *,
    days: list[WeeklyScheduleDay],
    sun_segments: list[WeeklyScheduleSegment],
    moon_segments: list[WeeklyScheduleSegment],
    asc_segments: list[WeeklyScheduleSegment],
) -> list[WeeklyScheduleRow]:
    rows: list[WeeklyScheduleRow] = []
    for hour in range(24):
        cells: list[WeeklyScheduleCell] = []
        for day in days:
            cell_start = day.start + timedelta(hours=hour)
            cell_end = cell_start + timedelta(hours=1)
            asc_cell = _intersect_segments(asc_segments, cell_start, cell_end)
            sun_cell = _intersect_segments(sun_segments, cell_start, cell_end)
            moon_cell = _intersect_segments(moon_segments, cell_start, cell_end)
            day_cell = _intersect_segments(day.ruler_segments, cell_start, cell_end)

            sun_component = _first_component(sun_cell, "sun", "Sun")
            moon_component = _first_component(moon_cell, "moon", "Moon")
            asc_component = _first_component(asc_cell, "ascendant", "Ascendant")
            day_component = _first_component(day_cell, day.ruler_key, POINT_LABELS.get(day.ruler_key, day.ruler_key.title()))

            component_elements = {
                (sun_component.element if sun_component else None),
                (moon_component.element if moon_component else None),
                (day_component.element if day_component else None),
                (asc_component.element if asc_component else None),
            }
            element_set = {
                str(element).strip().title()
                for element in component_elements
                if element and str(element).strip()
            }
            has_element_sigil = element_set == {"Fire", "Earth", "Air", "Water"}

            if SIGIL_DEBUG_ENABLED:
                print(
                    "weekly_sigil_check",
                    {
                        "start": cell_start.isoformat(),
                        "day": day.weekday,
                        "hour": hour,
                        "elements": sorted(element_set),
                        "result": has_element_sigil,
                        "components": {
                            "sun": {
                                "sign": sun_component.sign if sun_component else None,
                                "element": sun_component.element if sun_component else None,
                            },
                            "moon": {
                                "sign": moon_component.sign if moon_component else None,
                                "element": moon_component.element if moon_component else None,
                            },
                            "day": {
                                "key": day.ruler_key,
                                "sign": day_component.sign if day_component else None,
                                "element": day_component.element if day_component else None,
                            },
                            "asc": {
                                "sign": asc_component.sign if asc_component else None,
                                "element": asc_component.element if asc_component else None,
                            },
                        },
                    },
                )

            sigil = {
                "sunElement": sun_component.element if sun_component else "",
                "moonElement": moon_component.element if moon_component else "",
                "dayElement": day_component.element if day_component else "",
                "ascElement": asc_component.element if asc_component else "",
                "dayRulerKey": day.ruler_key,
                "sunSign": sun_component.sign if sun_component else "",
                "moonSign": moon_component.sign if moon_component else "",
                "daySign": day_component.sign if day_component else "",
                "ascSign": asc_component.sign if asc_component else "",
            }

            tooltip = {
                "windowStart": cell_start,
                "windowEnd": cell_end,
                "sun": sun_component.model_dump(mode="json") if sun_component else None,
                "moon": moon_component.model_dump(mode="json") if moon_component else None,
                "dayRuler": day_component.model_dump(mode="json") if day_component else None,
                "ascendant": asc_component.model_dump(mode="json") if asc_component else None,
                "dayRulerSegments": [segment.model_dump(mode="json") for segment in day_cell],
                "ascSegments": [segment.model_dump(mode="json") for segment in asc_cell],
            }

            cells.append(
                WeeklyScheduleCell(
                    start=cell_start,
                    end=cell_end,
                    asc_segments=asc_cell,
                    day_ruler_segment=day_cell,
                    sun_component=sun_component,
                    moon_component=moon_component,
                    has_element_sigil=has_element_sigil,
                    sigil=sigil,
                    tooltip=tooltip,
                )
            )

        rows.append(WeeklyScheduleRow(hour=hour, label=f"{hour:02d}:00", cells=cells))
    return rows


def build_weekly_ray_schedule(payload: WeeklyRayScheduleRequest) -> WeeklyRayScheduleResponse:
    if payload.mode not in {Mode.TRANSIT, Mode.NATAL_TRANSIT}:
        raise ValueError("Weekly ray schedule is supported only for transit and natal_transit modes.")

    cfg = ensure_config(payload.config)
    base = _moment_to_birth(payload.moment)
    anchor = to_local_datetime(base)
    week_start, week_end = _to_iso_week_window(anchor)

    sun_segments = _compute_point_segments(base=base, cfg=cfg, start=week_start, end=week_end, point_key="sun")
    moon_segments = _compute_point_segments(base=base, cfg=cfg, start=week_start, end=week_end, point_key="moon")
    asc_segments = _compute_point_segments(base=base, cfg=cfg, start=week_start, end=week_end, point_key="ascendant")
    moon_phase_utils = MoonPhaseUtils(base, cfg)

    days: list[WeeklyScheduleDay] = []
    for idx in range(7):
        day_start = week_start + timedelta(days=idx)
        day_end = day_start + timedelta(days=1)
        js_day_index = (day_start.weekday() + 1) % 7
        ruler_key = DAY_RULERS[js_day_index]
        ruler_segments, aura_segments = _compute_day_ruler_segments_for_day(
            base=base,
            cfg=cfg,
            day_start=day_start,
            day_end=day_end,
            ruler_key=ruler_key,
        )
        moon_phase, moon_illumination = _compute_day_moon_state(
            moon_phase_utils,
            day_start + timedelta(hours=12),
        )
        days.append(
            WeeklyScheduleDay(
                date=day_start,
                weekday=day_start.strftime("%A"),
                day_index=idx,
                ruler_key=ruler_key,
                ruler_icon=POINT_ICONS.get(ruler_key, "★"),
                ruler_segments=ruler_segments,
                aura_segments=aura_segments,
                has_ruler_split=len(ruler_segments) > 1,
                moon_phase=moon_phase,
                moon_illumination_percentage=moon_illumination,
                start=day_start,
                end=day_end,
            )
        )

    rows = _build_hourly_rows(days=days, sun_segments=sun_segments, moon_segments=moon_segments, asc_segments=asc_segments)

    return WeeklyRayScheduleResponse(
        week=WeeklyScheduleWeekMeta(
            start=week_start,
            end=week_end,
            tz=base.tz_str,
            default_window_start=6,
            default_window_end=20,
        ),
        sun_header_segments=sun_segments,
        moon_header_segments=moon_segments,
        days=days,
        rows=rows,
    )


def _hex_to_color(value: str, fallback: colors.Color = colors.HexColor("#0f172a")) -> colors.Color:
    try:
        return colors.HexColor(value)
    except Exception:
        return fallback


def _soft_pdf_color(value: str | None, whiten: float = 0.86) -> colors.Color:
    base = _hex_to_color(value or "#94a3b8", fallback=colors.HexColor("#94a3b8"))
    ratio = max(0.0, min(1.0, float(whiten)))
    red = base.red * (1.0 - ratio) + ratio
    green = base.green * (1.0 - ratio) + ratio
    blue = base.blue * (1.0 - ratio) + ratio
    return colors.Color(red, green, blue)


_GLYPH_ASCII = {
    "☉": "Sun",
    "☾": "Moon",
    "☿": "Mercury",
    "♀": "Venus",
    "♂": "Mars",
    "♃": "Jupiter",
    "♄": "Saturn",
    "↗": "Asc",
    "♈": "Aries",
    "♈︎": "Aries",
    "♉": "Taurus",
    "♉︎": "Taurus",
    "♊": "Gemini",
    "♊︎": "Gemini",
    "♋": "Cancer",
    "♋︎": "Cancer",
    "♌": "Leo",
    "♌︎": "Leo",
    "♍": "Virgo",
    "♍︎": "Virgo",
    "♎": "Libra",
    "♎︎": "Libra",
    "♏": "Scorpio",
    "♏︎": "Scorpio",
    "♐": "Sagittarius",
    "♐︎": "Sagittarius",
    "♑": "Capricorn",
    "♑︎": "Capricorn",
    "♒": "Aquarius",
    "♒︎": "Aquarius",
    "♓": "Pisces",
    "♓︎": "Pisces",
}

_SIGN_NUMBERS = {
    "aries": 1,
    "taurus": 2,
    "gemini": 3,
    "cancer": 4,
    "leo": 5,
    "virgo": 6,
    "libra": 7,
    "scorpio": 8,
    "sagittarius": 9,
    "capricorn": 10,
    "aquarius": 11,
    "pisces": 12,
}

_ROMAN = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
}


def _ascii_safe(value: str | None) -> str:
    text = str(value or "")
    for glyph, replacement in _GLYPH_ASCII.items():
        text = text.replace(glyph, replacement)
    return text.encode("ascii", "ignore").decode("ascii").strip()


def _sign_number(sign: str | None) -> int | None:
    key = _normalize_sign_name(sign).strip().lower()
    return _SIGN_NUMBERS.get(key)


def _sign_short(sign: str | None) -> str:
    full = _normalize_sign_name(sign)
    if not full:
        return "-"
    return _ascii_safe(full[:3].title())


def _ray_label_for_sign(sign: str | None) -> str:
    key = _normalize_sign_name(sign).strip().lower()
    rays = SIGN_RAYS.get(key, [])
    if not rays:
        return "Rays -"
    values = " · ".join(_ROMAN.get(int(ray), str(ray)) for ray in rays)
    return f"Rays {values}"


def _signs_line_ascii(segments: list[WeeklyScheduleSegment]) -> str:
    names: list[str] = []
    for segment in segments:
        label = _ascii_safe(segment.sign or "")
        if label and label not in names:
            names.append(label)
    return " · ".join(names) if names else "-"


def _month_label_for_week(start: datetime, end: datetime) -> str:
    end_inclusive = end - timedelta(seconds=1)
    left = start.strftime("%B")
    right = end_inclusive.strftime("%B")
    if left == right:
        return left
    return f"{left} · {right}"


def _fill_rect_alpha(c, x: float, y: float, width: float, height: float, color_value: colors.Color, alpha: float = 0.35) -> None:
    c.saveState()
    try:
        c.setFillAlpha(alpha)
    except Exception:
        pass
    c.setFillColor(color_value)
    c.rect(x, y, width, height, stroke=0, fill=1)
    c.restoreState()


def _draw_week_bar(
    *,
    c,
    segments: list[WeeklyScheduleSegment],
    week_start: datetime,
    week_end: datetime,
    x: float,
    y: float,
    width: float,
    height: float,
    label: str,
) -> None:
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#1f2937"))
    c.drawString(x - 34, y + 2, label)
    total = max((week_end - week_start).total_seconds(), 1.0)
    for segment in segments:
        seg_secs = max((segment.start - week_start).total_seconds(), 0.0)
        seg_len = max((segment.end - segment.start).total_seconds(), 0.0)
        seg_x = x + (seg_secs / total) * width
        seg_w = (seg_len / total) * width
        if seg_w <= 0:
            continue
        _fill_rect_alpha(c, seg_x, y, seg_w, height, _soft_pdf_color(segment.color or "#334155", whiten=0.84), alpha=0.85)
    c.setStrokeColor(colors.HexColor("#9ca3af"))
    c.rect(x, y, width, height, stroke=1, fill=0)


def _resolve_pdf_fonts() -> tuple[str, str, bool]:
    regular_name = "Helvetica"
    bold_name = "Helvetica-Bold"
    candidates = [
        (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")),
        (Path("/Library/Fonts/Arial Unicode.ttf"), None),
        (Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"), None),
        (Path("/System/Library/Fonts/Supplemental/Arial.ttf"), Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")),
    ]
    for regular_path, bold_path in candidates:
        if not regular_path.exists():
            continue
        try:
            regular_name = "WeeklyRayPDF-Regular"
            bold_name = "WeeklyRayPDF-Bold"
            if regular_name not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont(regular_name, str(regular_path)))
            bold_source = bold_path if bold_path and bold_path.exists() else regular_path
            if bold_name not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont(bold_name, str(bold_source)))
            return regular_name, bold_name, True
        except Exception:
            regular_name = "Helvetica"
            bold_name = "Helvetica-Bold"
            continue
    return regular_name, bold_name, False


def render_weekly_schedule_pdf(
    schedule: WeeklyRayScheduleResponse,
    *,
    hour_start: int = 6,
    hour_end: int = 20,
    filename_prefix: str = "weekly-ray-schedule",
) -> bytes:
    if hour_end <= hour_start:
        raise ValueError("hour_end must be greater than hour_start.")

    tmp_dir = Path(tempfile.mkdtemp(prefix="weekly_ray_schedule_pdf_"))
    try:
        pdf_path = tmp_dir / f"{filename_prefix}.pdf"
        page_width, page_height = landscape(A4)
        c = canvas.Canvas(str(pdf_path), pagesize=(page_width, page_height))
        regular_font, bold_font, has_unicode_font = _resolve_pdf_fonts()

        margin = 20.0
        hour_col_w = 36.0
        grid_x = margin + hour_col_w
        grid_w = page_width - margin - grid_x
        col_w = grid_w / 7.0

        title_y = page_height - margin + 2
        c.setFillColor(colors.white)
        c.rect(0, 0, page_width, page_height, stroke=0, fill=1)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(bold_font, 12)
        month_name = schedule.week.start.strftime("%B")
        dominant_sun = max(schedule.sun_header_segments, key=lambda segment: float(segment.ratio or 0.0), default=None)
        dominant_moon = max(schedule.moon_header_segments, key=lambda segment: float(segment.ratio or 0.0), default=None)
        dominant_sun_sign = _ascii_safe(dominant_sun.sign if dominant_sun else "-")
        dominant_moon_sign = _ascii_safe(dominant_moon.sign if dominant_moon else "-")
        dominant_moon_number = _sign_number(dominant_moon.sign if dominant_moon else None)
        moon_no_text = str(dominant_moon_number) if dominant_moon_number is not None else "-"

        c.drawString(margin, title_y, _ascii_safe(f"Weekly Ray Schedule · {month_name}"))
        c.setFont(regular_font, 8)
        c.setFillColor(colors.HexColor("#334155"))
        c.drawString(margin, title_y - 11, _ascii_safe(f"Sun in {dominant_sun_sign} · Moon #{moon_no_text} in {dominant_moon_sign}"))
        c.drawString(
            margin,
            title_y - 20,
            f"{schedule.week.start.strftime('%Y-%m-%d %H:%M')} · {schedule.week.end.strftime('%Y-%m-%d %H:%M')} ({schedule.week.tz})",
        )

        bars_top = page_height - 70
        sun_h = 24
        moon_h = 18
        sun_y = bars_top
        moon_y = sun_y - moon_h - 4

        _draw_week_bar(
            c=c,
            segments=schedule.sun_header_segments,
            week_start=schedule.week.start,
            week_end=schedule.week.end,
            x=grid_x,
            y=sun_y,
            width=grid_w,
            height=sun_h,
            label="Sun",
        )
        sun_week_number = schedule.week.start.isocalendar().week
        sun_month_label = _month_label_for_week(schedule.week.start, schedule.week.end)
        sun_signs = _signs_line_ascii(schedule.sun_header_segments)
        c.setFillColor(colors.HexColor("#111827"))
        c.setFont(bold_font, 7.2)
        c.drawCentredString(grid_x + grid_w / 2, sun_y + sun_h - 7, _ascii_safe(f"Week #{sun_week_number}"))
        c.setFont(regular_font, 7.0)
        c.drawCentredString(grid_x + grid_w / 2, sun_y + sun_h - 14, _ascii_safe(sun_month_label))
        c.drawCentredString(grid_x + grid_w / 2, sun_y + 3, sun_signs)

        _draw_week_bar(
            c=c,
            segments=schedule.moon_header_segments,
            week_start=schedule.week.start,
            week_end=schedule.week.end,
            x=grid_x,
            y=moon_y,
            width=grid_w,
            height=moon_h,
            label="Moon",
        )
        moon_signs = _signs_line_ascii(schedule.moon_header_segments)
        c.setFillColor(colors.HexColor("#111827"))
        c.setFont(regular_font, 6.9)
        c.drawCentredString(grid_x + grid_w / 2, moon_y + moon_h / 2 - 2, moon_signs)

        day_header_y = moon_y - 50
        day_header_h = 50
        for idx, day in enumerate(schedule.days):
            x = grid_x + idx * col_w
            _fill_rect_alpha(c, x, day_header_y, col_w, day_header_h, _soft_pdf_color("#cbd5e1", whiten=0.92), alpha=1.0)

            cursor = 0.0
            for segment in day.aura_segments:
                seg_w = col_w * max(0.0, float(segment.ratio))
                _fill_rect_alpha(c, x + cursor, day_header_y, seg_w, day_header_h, _soft_pdf_color(segment.color or "#334155", whiten=0.88), alpha=0.92)
                cursor += seg_w
                if 0 < cursor < col_w:
                    c.setStrokeColor(colors.HexColor("#64748b"))
                    c.setLineWidth(0.6)
                    c.line(x + cursor, day_header_y + 2, x + cursor, day_header_y + day_header_h - 2)

            c.setStrokeColor(colors.HexColor("#9ca3af"))
            c.setLineWidth(0.6)
            c.rect(x, day_header_y, col_w, day_header_h, stroke=1, fill=0)

            day_ruler_name = POINT_LABELS.get(day.ruler_key, day.ruler_key.title())
            day_ruler_icon = POINT_ICONS.get(day.ruler_key, "")
            sign_and_rays_parts: list[str] = []
            for segment in day.ruler_segments:
                sign_name = _ascii_safe(segment.sign or "-")
                sign_icon = segment.sign_icon if has_unicode_font else ""
                sign_label = f"{sign_icon} {sign_name}".strip() if sign_icon else sign_name
                sign_and_rays_parts.append(_ascii_safe(f"{sign_label} · {_ray_label_for_sign(segment.sign)}") if not has_unicode_font else f"{sign_label} · {_ray_label_for_sign(segment.sign)}")
            sign_and_rays = " · ".join(sign_and_rays_parts) if sign_and_rays_parts else "-"
            day_line = _ascii_safe(day.weekday)
            date_line = _ascii_safe(day.start.strftime("%d %b"))
            if has_unicode_font and day_ruler_icon:
                ruler_line = f"{day_ruler_icon} {day_ruler_name}"
            else:
                ruler_line = _ascii_safe(day_ruler_name)
            merged_day_line = _ascii_safe(f"{date_line} · {day_line}")
            moon_phase = _ascii_safe(day.moon_phase or "Moon cycle")
            try:
                day_illumination = float(day.moon_illumination_percentage) if day.moon_illumination_percentage is not None else None
            except (TypeError, ValueError):
                day_illumination = None
            if day_illumination is None:
                moon_line = moon_phase
            else:
                moon_line = _ascii_safe(f"{moon_phase} · {int(round(day_illumination))}%")
            if has_unicode_font:
                moon_line = f"☾ · {moon_line}"
            else:
                moon_line = _ascii_safe(f"Moon · {moon_line}")

            c.setFillColor(colors.HexColor("#111827"))
            c.setFont(bold_font, 6.4)
            c.drawCentredString(x + col_w / 2, day_header_y + 39, ruler_line)
            c.setFont(regular_font, 6.2)
            c.drawCentredString(x + col_w / 2, day_header_y + 28, sign_and_rays)
            c.drawCentredString(x + col_w / 2, day_header_y + 17, merged_day_line)
            c.setFont(regular_font, 5.9)
            c.drawCentredString(x + col_w / 2, day_header_y + 7, moon_line)

        grid_top = day_header_y
        visible_hours = list(range(hour_start, hour_end))
        row_count = max(len(visible_hours), 1)
        grid_h = grid_top - margin
        row_h = grid_h / row_count
        row_map = {row.hour: row for row in schedule.rows}

        for row_idx, hour in enumerate(visible_hours):
            y = grid_top - (row_idx + 1) * row_h
            c.setFillColor(colors.HexColor("#334155"))
            c.setFont(regular_font, 7)
            c.drawRightString(grid_x - 4, y + row_h * 0.35, f"{hour:02d}:00")

            row = row_map.get(hour)
            for col_idx in range(7):
                x = grid_x + col_idx * col_w
                c.setFillColor(colors.HexColor("#f8fafc"))
                c.rect(x, y, col_w, row_h, stroke=0, fill=1)

                cell = row.cells[col_idx] if row and col_idx < len(row.cells) else None
                if cell:
                    cursor = 0.0
                    for segment in cell.asc_segments:
                        seg_w = col_w * max(0.0, float(segment.ratio))
                        _fill_rect_alpha(c, x + cursor, y, seg_w, row_h, _soft_pdf_color(segment.color or "#334155", whiten=0.88), alpha=0.92)
                        cursor += seg_w

                    aura_h = min(4.0, row_h * 0.24)
                    cursor = 0.0
                    for segment in cell.day_ruler_segment:
                        seg_w = col_w * max(0.0, float(segment.ratio))
                        _fill_rect_alpha(
                            c,
                            x + cursor,
                            y + row_h - aura_h,
                            seg_w,
                            aura_h,
                            _soft_pdf_color(segment.color or "#475569", whiten=0.9),
                            alpha=0.94,
                        )
                        cursor += seg_w

                    sign_labels: list[str] = []
                    for segment in cell.asc_segments:
                        label = _sign_short(segment.sign)
                        if label != "-" and label not in sign_labels:
                            sign_labels.append(label)
                    sign_text = " · ".join(sign_labels) if sign_labels else "-"
                    c.setFillColor(colors.HexColor("#111827"))
                    c.setFont(bold_font, 6.5)
                    c.drawCentredString(x + col_w / 2, y + row_h * 0.42, sign_text)

                    if cell.has_element_sigil:
                        c.setFillColor(colors.HexColor("#111827"))
                        c.setFont(bold_font, 7)
                        c.drawString(x + 2, y + 2, "*")

                c.setStrokeColor(colors.HexColor("#cbd5e1"))
                c.setLineWidth(0.4)
                c.rect(x, y, col_w, row_h, stroke=1, fill=0)

        c.save()
        return pdf_path.read_bytes()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
