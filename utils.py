from __future__ import annotations

from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path
import shutil
import tempfile
from typing import Generator, Optional
from zoneinfo import ZoneInfo
from calendar import monthrange
import re
import textwrap

from kerykeion import AstrologicalSubjectFactory, AspectsFactory  # type: ignore
from kerykeion.charts.chart_drawer import ChartDrawer  # type: ignore
from reportlab.lib.pagesizes import letter  # type: ignore
from reportlab.pdfgen import canvas  # type: ignore
from reportlab.graphics import renderPDF  # type: ignore
from svglib.svglib import svg2rlg  # type: ignore
from reportlab.lib.units import inch  # type: ignore
from reportlab.lib import colors  # type: ignore
from reportlab.platypus import SimpleDocTemplate, Image, Spacer, Table, TableStyle, Paragraph  # type: ignore
from reportlab.lib.styles import getSampleStyleSheet  # type: ignore
import cairosvg  # type: ignore
from reportlab.platypus.doctemplate import LayoutError  # type: ignore
from reportlab.lib.utils import ImageReader  # type: ignore

from enums import RangeGranularity, ZodiacType, ReportKind, Mode
from schemas import BirthData, ChartConfig, ReportRequest


def ensure_config(config: Optional[ChartConfig]) -> ChartConfig:
    """
    Ensure we always operate with a full ChartConfig instance, applying
    API-level defaults when the caller passed None.
    """
    if config is None:
        config = ChartConfig()
    # If zodiac is tropical, sidereal mode should not affect calculations.
    if config.zodiac_type == ZodiacType.TROPIC:
        config.sidereal_mode = None
    return config


def resolve_mode(request: ReportRequest) -> Mode:
    """
    Infer the working mode for a report request.
    """
    mode = request.mode
    if mode is None:
        if request.first and request.second:
            mode = Mode.RELATIONSHIP
        elif request.birth and request.moment:
            mode = Mode.NATAL_TRANSIT
        elif request.moment:
            mode = Mode.TRANSIT
        else:
            mode = Mode.NATAL
    return mode


def build_subject(birth: BirthData, config: Optional[ChartConfig]):
    """
    Create a Kerykeion AstrologicalSubject from BirthData + ChartConfig.
    """
    cfg = ensure_config(config)

    kwargs = dict(
        name=birth.name,
        year=birth.year,
        month=birth.month,
        day=birth.day,
        hour=birth.hour,
        minute=birth.minute,
        lng=birth.lng,
        lat=birth.lat,
        tz_str=birth.tz_str,
        online=False,
    )

    # Chart configuration
    kwargs["zodiac_type"] = cfg.zodiac_type.value
    if cfg.zodiac_type == ZodiacType.SIDEREAL and cfg.sidereal_mode is not None:
        kwargs["sidereal_mode"] = cfg.sidereal_mode.value
    kwargs["perspective_type"] = cfg.perspective.value
    kwargs["houses_system_identifier"] = cfg.house_system.value

    subject = AstrologicalSubjectFactory.from_birth_data(**kwargs)

    # Optionally override city/nation labels if provided explicitly in the request
    if birth.city:
        setattr(subject, "city", birth.city)
    if birth.nation:
        setattr(subject, "nation", birth.nation)

    return subject


def build_subject_for_moment(
    base: BirthData,
    dt: datetime,
    config: Optional[ChartConfig],
):
    """
    Reuse base location / timezone, but override date & time with the given datetime.
    """
    return build_subject(
        BirthData(
            name=base.name,
            year=dt.year,
            month=dt.month,
            day=dt.day,
            hour=dt.hour,
            minute=dt.minute,
            lng=base.lng,
            lat=base.lat,
            tz_str=base.tz_str,
            city=base.city,
            nation=base.nation,
        ),
        config,
    )


def sign_display(sign: Optional[str]) -> str:
    """Return a readable zodiac sign label from a short code."""
    if not sign:
        return "-"
    mapping = {
        "Ari": "Aries",
        "Tau": "Taurus",
        "Gem": "Gemini",
        "Can": "Cancer",
        "Leo": "Leo",
        "Vir": "Virgo",
        "Lib": "Libra",
        "Sco": "Scorpio",
        "Sag": "Sagittarius",
        "Cap": "Capricorn",
        "Aqu": "Aquarius",
        "Pis": "Pisces",
    }
    return mapping.get(sign, sign)


def format_degree(position: Optional[float]) -> str:
    """
    Format a position in degrees and minutes using ASCII-safe markers.
    """
    if position is None:
        return "-"
    degrees = int(position)
    minutes = int(round((position - degrees) * 60))
    if minutes == 60:
        degrees += 1
        minutes = 0
    return f"{degrees}d {minutes:02d}m"


def house_display(name: Optional[str]) -> str:
    """
    Convert a house identifier like 'Eleventh_House' into a friendly label.
    """
    if not name:
        return "-"
    base = name.replace("_House", "").replace("_", " ")
    ordinal_map = {
        "First": "1st",
        "Second": "2nd",
        "Third": "3rd",
        "Fourth": "4th",
        "Fifth": "5th",
        "Sixth": "6th",
        "Seventh": "7th",
        "Eighth": "8th",
        "Ninth": "9th",
        "Tenth": "10th",
        "Eleventh": "11th",
        "Twelfth": "12th",
    }
    parts = base.split()
    if parts:
        first = parts[0]
        ordinal = ordinal_map.get(first, first)
        rest = " ".join(parts[1:]) if len(parts) > 1 else "House"
        if not rest:
            rest = "House"
        return f"{ordinal} {rest}".strip()
    return base


def extract_points_table(subject_data: dict) -> list[dict]:
    """
    Build a clean list of planetary/angle positions from a subject dump.
    """
    rows: list[dict] = []
    for code in subject_data.get("active_points", []) or []:
        key = code.lower()
        point = subject_data.get(key)
        if not isinstance(point, dict):
            continue
        rows.append(
            {
                "name": point.get("name", code).replace("_", " "),
                "sign": sign_display(point.get("sign")),
                "degree": format_degree(point.get("position")),
                "house": house_display(point.get("house")),
                "retrograde": bool(point.get("retrograde")),
            }
        )
    return rows


def extract_houses_table(subject_data: dict) -> list[dict]:
    """
    Build a table of house cusps from a subject dump.
    """
    rows: list[dict] = []
    for name in subject_data.get("houses_names_list", []) or []:
        key = name.lower()
        house = subject_data.get(key)
        if not isinstance(house, dict):
            continue
        rows.append(
            {
                "name": house_display(house.get("name", name)),
                "sign": sign_display(house.get("sign")),
                "degree": format_degree(house.get("position")),
            }
        )
    return rows


def to_local_datetime(birth: BirthData) -> datetime:
    """Convert BirthData to an aware datetime using tz_str."""
    tz = ZoneInfo(birth.tz_str)
    return datetime(
        birth.year,
        birth.month,
        birth.day,
        birth.hour,
        birth.minute,
        tzinfo=tz,
    )


def add_months(dt: datetime, months: int) -> datetime:
    """Add a number of months to a datetime, keeping timezone and clamping the day."""
    year = dt.year + (dt.month - 1 + months) // 12
    month = (dt.month - 1 + months) % 12 + 1
    last_day = monthrange(year, month)[1]
    day = min(dt.day, last_day)
    return dt.replace(year=year, month=month, day=day)


def iter_range_datetimes(
    start: datetime,
    end: datetime,
    granularity: RangeGranularity,
) -> Generator[datetime, None, None]:
    """Yield datetimes from start to end (inclusive) according to the desired granularity."""
    if start > end:
        raise ValueError("start must be <= end")

    current = start

    if granularity == RangeGranularity.MINUTE:
        delta = timedelta(minutes=1)
        while current <= end:
            yield current
            current += delta
    elif granularity == RangeGranularity.HOUR:
        delta = timedelta(hours=1)
        while current <= end:
            yield current
            current += delta
    elif granularity == RangeGranularity.DAY:
        delta = timedelta(days=1)
        while current <= end:
            yield current
            current += delta
    elif granularity == RangeGranularity.MONTH:
        while current <= end:
            yield current
            current = add_months(current, 1)
    else:
        raise ValueError(f"Unsupported granularity: {granularity}")


def render_svg_to_string(drawer: ChartDrawer, filename_prefix: str = "chart") -> str:
    """
    Render the given ChartDrawer to an SVG string.

    Kerykeion currently saves charts to disk, so we use a temporary directory
    internally and read the generated file back as text.
    """
    tmp_dir = Path(tempfile.mkdtemp(prefix="kerykeion_api_"))
    try:
        drawer.save_svg(output_path=tmp_dir, filename=filename_prefix)
        svg_path = tmp_dir / f"{filename_prefix}.svg"
        return svg_path.read_text(encoding="utf-8")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def build_subject_block(
    birth: BirthData,
    cfg: ChartConfig,
    label: str,
) -> tuple[dict, object]:
    """
    Build a structured block for a single subject, returning both the block and the raw subject.
    """
    subject = build_subject(birth, cfg)
    subject_data = subject.model_dump(mode="json")

    meta = {
        "name": subject_data.get("name") or birth.name,
        "local_datetime": subject_data.get("iso_formatted_local_datetime"),
        "utc_datetime": subject_data.get("iso_formatted_utc_datetime"),
        "location": ", ".join([v for v in [birth.city, birth.nation] if v]),
        "tz": birth.tz_str,
        "zodiac_type": subject_data.get("zodiac_type"),
        "sidereal_mode": subject_data.get("sidereal_mode"),
        "house_system": subject_data.get("houses_system_name") or subject_data.get("houses_system_identifier"),
        "perspective": subject_data.get("perspective_type"),
    }

    block = {
        "label": label,
        "meta": meta,
        "lunar_phase": subject_data.get("lunar_phase"),
        "points": extract_points_table(subject_data),
        "houses": extract_houses_table(subject_data),
        "raw_subject": subject_data,
    }
    return block, subject


def extract_aspect_rows(aspects_data: dict) -> list[dict]:
    """
    Normalize dual/synastry aspect entries into a lightweight table.
    """
    def label_from_value(value) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, dict):
            for key in ("name", "point", "planet", "label", "body"):
                if value.get(key):
                    return str(value[key]).replace("_", " ")
            if value.get("emoji") and value.get("name"):
                return f"{value['name']} {value['emoji']}".replace("_", " ")
            return str(value)
        return str(value)

    def pick(entry: dict, keys: list[str], fallback_tokens: tuple[str, ...]) -> Optional[str]:
        for key in keys:
            if key in entry:
                label = label_from_value(entry[key])
                if label:
                    return label
        for key, val in entry.items():
            lower = key.lower()
            if any(tok in lower for tok in fallback_tokens):
                label = label_from_value(val)
                if label:
                    return label
        return None

    def pick_orb(entry: dict) -> tuple[Optional[str], Optional[float]]:
        for key in ("orb", "difference", "orb_value", "orb_value_deg", "orb_deg", "orbit", "diff"):
            if key in entry and entry[key] is not None:
                val = entry[key]
                if isinstance(val, (int, float)):
                    return f"{val:.2f}°", float(val)
                try:
                    num = float(val)
                    return f"{num:.2f}°", num
                except Exception:
                    return str(val), None
        return None, None

    candidates: list = []
    if isinstance(aspects_data, list):
        candidates = aspects_data
    else:
        for key in ("aspects", "aspects_list", "dual_chart_aspects", "aspect_list"):
            val = aspects_data.get(key) if isinstance(aspects_data, dict) else None
            if isinstance(val, list):
                candidates = val
                break

    rows: list[dict] = []
    for entry in candidates:
        if not isinstance(entry, dict):
            rows.append({"summary": str(entry)})
            continue
        left = pick(
            entry,
            [
                "first_point",
                "inner_point",
                "planet_a",
                "point_a",
                "point1",
                "planet1",
                "left",
                "first",
                "inner",
            ],
            ("first", "inner", "_a", "1"),
        )
        right = pick(
            entry,
            [
                "second_point",
                "outer_point",
                "planet_b",
                "point_b",
                "point2",
                "planet2",
                "right",
                "second",
                "outer",
            ],
            ("second", "outer", "_b", "2"),
        )
        aspect_name = (
            entry.get("aspect")
            or entry.get("aspect_type")
            or entry.get("angle")
            or entry.get("name")
            or entry.get("aspect_name")
        )
        orb_str, orb_value = pick_orb(entry)
        movement = entry.get("aspect_movement") or entry.get("movement") or entry.get("direction")
        rows.append(
            {
                "left": left or "Point A",
                "aspect": aspect_name or "Aspect",
                "right": right or "Point B",
                "orb": orb_str,
                "orb_value": orb_value,
                "movement": movement,
                "raw": entry,
            }
        )
    return rows


def render_markdown_report(structured: dict) -> str:
    """
    Render a Markdown-flavored view of the structured report.
    """
    lines: list[str] = []
    title = structured.get("title") or "Astrology Report"
    summary = structured.get("summary")
    lines.append(f"# {title}")
    if summary:
        lines.append("")
        lines.append(summary)

    for subject in structured.get("subjects", []):
        meta = subject.get("meta", {})
        lines.append("")
        lines.append(f"## {subject.get('label')}: {meta.get('name', 'Chart')}")
        meta_bits = []
        if meta.get("local_datetime"):
            meta_bits.append(f"**Date & time:** {meta['local_datetime']} ({meta.get('tz', '')})")
        if meta.get("location"):
            meta_bits.append(f"**Location:** {meta['location']}")
        if meta.get("zodiac_type"):
            zodiac = meta["zodiac_type"]
            if meta.get("sidereal_mode"):
                zodiac = f"{zodiac} - {meta['sidereal_mode']}"
            meta_bits.append(f"**Zodiac:** {zodiac}")
        if meta.get("house_system"):
            meta_bits.append(f"**Houses:** {meta['house_system']}")
        if meta_bits:
            for bit in meta_bits:
                lines.append(f"- {bit}")
        lunar = subject.get("lunar_phase")
        if isinstance(lunar, dict) and lunar.get("moon_phase_name"):
            lines.append(f"- **Lunar phase:** {lunar.get('moon_phase_name')} {lunar.get('moon_emoji', '')}".rstrip())

        points = subject.get("points", [])
        if points:
            lines.append("")
            lines.append("### Planetary positions")
            lines.append("| Body | Sign | Degree | House | Rx |")
            lines.append("| --- | --- | --- | --- | --- |")
            for row in points:
                rx = "R" if row.get("retrograde") else ""
                lines.append(
                    f"| {row.get('name','')} | {row.get('sign','')} | {row.get('degree','')} | {row.get('house','')} | {rx} |"
                )

        houses = subject.get("houses", [])
        if houses:
            lines.append("")
            lines.append("### Houses")
            lines.append("| House | Sign | Degree |")
            lines.append("| --- | --- | --- |")
            for row in houses:
                lines.append(
                    f"| {row.get('name','')} | {row.get('sign','')} | {row.get('degree','')} |"
                )

        aspects_block = subject.get("aspects") or {}
        aspects_rows = aspects_block.get("rows") or []
        aspects_summary = aspects_block.get("summary") or {}
        if aspects_rows:
            lines.append("")
            lines.append("### Aspects")
            if aspects_block.get("title"):
                lines.append(f"**{aspects_block['title']}**")
            if aspects_summary:
                lines.append(
                    f"- Total aspects: {aspects_summary.get('total', 0)} "
                    f"(Applying: {aspects_summary.get('applying', 0)}, Separating: {aspects_summary.get('separating', 0)}, Fixed: {aspects_summary.get('fixed', 0)})"
                )
            lines.append("")
            lines.append("| Point A | Aspect | Point B | Orb | Movement |")
            lines.append("| --- | --- | --- | --- | --- |")
            for row in aspects_rows:
                lines.append(
                    f"| {row.get('left','')} | {row.get('aspect','')} | {row.get('right','')} | {row.get('orb','')} | {row.get('movement','')} |"
                )

    synastry = structured.get("synastry")
    if synastry:
        lines.append("")
        lines.append("## Synastry aspects")
        if synastry.get("title"):
            lines.append(f"**{synastry['title']}**")
        summary = synastry.get("summary") or {}
        if summary:
            lines.append("")
            lines.append(
                f"- Total aspects: {summary.get('total', 0)} "
                f"(Applying: {summary.get('applying', 0)}, Separating: {summary.get('separating', 0)}, Fixed: {summary.get('fixed', 0)})"
            )
            closest = summary.get("closest") or []
            if closest:
                lines.append("- Tightest aspects:")
                for item in closest:
                    lines.append(
                        f"  - {item.get('left','')} {item.get('aspect','')} {item.get('right','')} (orb {item.get('orb','')}, {item.get('movement','')})"
                    )
        rows = synastry.get("rows", [])
        if rows:
            lines.append("")
            lines.append("| Inner | Aspect | Outer | Orb | Movement |")
            lines.append("| --- | --- | --- | --- | --- |")
            for row in rows:
                lines.append(
                    f"| {row.get('left','')} | {row.get('aspect','')} | {row.get('right','')} | {row.get('orb','')} | {row.get('movement','')} |"
                )

    return "\n".join(lines).strip()


def generate_report_content(request: ReportRequest) -> tuple[dict, str]:
    """
    Build a structured report plus a Markdown representation.
    """
    cfg = ensure_config(request.config)
    mode = resolve_mode(request)

    structured: dict = {
        "mode": mode.value,
        "kind": request.kind.value,
        "config": cfg.model_dump(mode="json"),
        "subjects": [],
    }

    def add_subject(birth: BirthData, label: str) -> tuple[dict, object]:
        block, subject = build_subject_block(birth, cfg, label)
        if request.include_aspects:
            try:
                aspects_model = AspectsFactory.natal_aspects(subject)
                aspects_dump = aspects_model.model_dump(mode="json")
                aspect_rows = extract_aspect_rows(aspects_dump)
                if request.max_aspects:
                    aspect_rows = aspect_rows[: request.max_aspects]
                block["aspects"] = {
                    "title": f"{label} aspects",
                    "rows": aspect_rows,
                    "summary": build_synastry_summary(aspect_rows),
                    "raw": aspects_dump,
                }
            except Exception:
                block["aspects"] = {"rows": [], "summary": {}}
        structured["subjects"].append(block)
        return block, subject

    def build_synastry_summary(rows: list[dict]) -> dict:
        if not rows:
            return {}
        applying = sum(1 for r in rows if str(r.get("movement", "")).lower().startswith("app"))
        separating = sum(1 for r in rows if str(r.get("movement", "")).lower().startswith("sep"))
        fixed = sum(1 for r in rows if str(r.get("movement", "")).lower().startswith("fix"))

        def orb_key(row: dict) -> float:
            val = row.get("orb_value")
            if isinstance(val, (int, float)):
                return abs(val)
            try:
                # strip degree symbol if present
                s = str(row.get("orb", "")).replace("°", "").strip()
                return abs(float(s))
            except Exception:
                return 9999.0

        closest = sorted(rows, key=orb_key)[:5]
        return {
            "total": len(rows),
            "applying": applying,
            "separating": separating,
            "fixed": fixed,
            "closest": [
                {k: v for k, v in item.items() if k in {"left", "right", "aspect", "orb", "movement"}}
                for item in closest
            ],
        }

    if mode == Mode.RELATIONSHIP and request.first and request.second:
        first_block, first_subject = add_subject(request.first, "Partner A")
        second_block, second_subject = add_subject(request.second, "Partner B")
        structured["title"] = f"Synastry report - {first_block['meta']['name']} natal + {second_block['meta']['name']} natal"
        structured["summary"] = "Dual-wheel synastry overview with shared aspects."

        aspects_model = AspectsFactory.dual_chart_aspects(first_subject, second_subject)
        aspects_dump = aspects_model.model_dump(mode="json")
        aspect_rows = extract_aspect_rows(aspects_dump)
        if not request.include_aspects:
            aspect_rows = []
        elif request.max_aspects:
            aspect_rows = aspect_rows[: request.max_aspects]
        structured["synastry"] = {
            "title": f"{first_block['meta']['name']} <-> {second_block['meta']['name']}",
            "rows": aspect_rows,
            "summary": build_synastry_summary(aspect_rows),
            "raw": aspects_dump,
        }
    elif mode == Mode.NATAL_TRANSIT and request.birth and request.moment:
        natal_block, natal_subject = add_subject(request.birth, "Natal")
        m = request.moment
        transit_birth = BirthData(
            name=getattr(m, "name", None) or "Transit moment",
            year=m.year,
            month=m.month,
            day=m.day,
            hour=m.hour,
            minute=m.minute,
            lat=m.lat,
            lng=m.lng,
            tz_str=m.tz_str,
            city=m.city,
            nation=m.nation,
        )
        transit_block, transit_subject = add_subject(transit_birth, "Transit")
        structured["title"] = f"Dual-wheel report - {natal_block['meta']['name']} natal + transit"
        structured["summary"] = "Natal chart paired with a transit snapshot."

        try:
            aspects_model = AspectsFactory.dual_chart_aspects(natal_subject, transit_subject)
            aspects_dump = aspects_model.model_dump(mode="json")
            aspect_rows = extract_aspect_rows(aspects_dump)
            if not request.include_aspects:
                aspect_rows = []
            elif request.max_aspects:
                aspect_rows = aspect_rows[: request.max_aspects]
            structured["synastry"] = {
                "title": f"{natal_block['meta']['name']} <-> Transit",
                "rows": aspect_rows,
                "summary": build_synastry_summary(aspect_rows),
                "raw": aspects_dump,
            }
        except Exception:
            # Transit aspects are optional; continue even if not available.
            pass
    elif mode == Mode.TRANSIT and request.moment:
        m = request.moment
        transit_birth = BirthData(
            name=getattr(m, "name", None) or "Transit snapshot",
            year=m.year,
            month=m.month,
            day=m.day,
            hour=m.hour,
            minute=m.minute,
            lat=m.lat,
            lng=m.lng,
            tz_str=m.tz_str,
            city=m.city,
            nation=m.nation,
        )
        add_subject(transit_birth, "Transit")
        structured["title"] = "Transit report"
        structured["summary"] = "Current sky positions without natal overlay."
    else:
        add_subject(request.birth, "Natal")
        structured["title"] = f"Natal report - {request.birth.name}"
        structured["summary"] = "Full natal positions with houses and angles."

    markdown = render_markdown_report(structured)
    structured["markdown"] = markdown
    return structured, markdown


def generate_report_text(request: ReportRequest) -> str:
    """
    Backwards-compatible wrapper that returns only the Markdown report text.
    """
    _, markdown = generate_report_content(request)
    return markdown


def render_report_text_pdf(report_text: str, filename_prefix: str = "report") -> bytes:
    """
    Render plain report text into a simple PDF for download.
    """
    tmp_dir = Path(tempfile.mkdtemp(prefix="kerykeion_report_pdf_"))
    try:
        pdf_path = tmp_dir / f"{filename_prefix}.pdf"
        c = canvas.Canvas(str(pdf_path), pagesize=letter)
        width, height = letter
        y = height - 40
        c.setFont("Helvetica", 10)
        for line in report_text.splitlines():
            for wrapped in textwrap.wrap(line, width=110) or [""]:
                c.drawString(40, y, wrapped)
                y -= 12
                if y < 40:
                    c.showPage()
                    c.setFont("Helvetica", 10)
                    y = height - 40
        c.save()
        return pdf_path.read_bytes()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def render_structured_report_pdf(report: dict, filename_prefix: str = "report") -> bytes:
    """
    Render a richer PDF from the structured report payload (subjects + aspects).
    """
    tmp_dir = Path(tempfile.mkdtemp(prefix="kerykeion_report_pdf_"))
    try:
        pdf_path = tmp_dir / f"{filename_prefix}.pdf"
        doc = SimpleDocTemplate(
            str(pdf_path),
            pagesize=letter,
            leftMargin=40,
            rightMargin=40,
            topMargin=40,
            bottomMargin=40,
        )
        styles = getSampleStyleSheet()
        story = []

        title = report.get("title") or "Astrology Report"
        summary = report.get("summary")
        story.append(Paragraph(title, styles["Title"]))
        if summary:
            story.append(Spacer(1, 8))
            story.append(Paragraph(summary, styles["BodyText"]))

        for subject in report.get("subjects", []):
            meta = subject.get("meta", {})
            story.append(Spacer(1, 14))
            story.append(
                Paragraph(
                    f"{subject.get('label', 'Chart')}: {meta.get('name', '')}",
                    styles["Heading2"],
                )
            )
            meta_lines = []
            if meta.get("local_datetime"):
                tz = f" ({meta.get('tz')})" if meta.get("tz") else ""
                meta_lines.append(f"Date & time: {meta['local_datetime']}{tz}")
            if meta.get("location"):
                meta_lines.append(f"Location: {meta['location']}")
            if meta.get("zodiac_type"):
                zodiac = meta["zodiac_type"]
                if meta.get("sidereal_mode"):
                    zodiac = f"{zodiac} - {meta['sidereal_mode']}"
                meta_lines.append(f"Zodiac: {zodiac}")
            if meta.get("house_system"):
                meta_lines.append(f"Houses: {meta['house_system']}")
            if meta_lines:
                story.append(Paragraph("<br/>".join(meta_lines), styles["BodyText"]))

            if subject.get("lunar_phase"):
                lunar = subject["lunar_phase"]
                if isinstance(lunar, dict) and lunar.get("moon_phase_name"):
                    story.append(
                        Paragraph(
                            f"Lunar phase: {lunar.get('moon_phase_name')}",
                            styles["BodyText"],
                        )
                    )

            points = subject.get("points", [])
            if points:
                story.append(Spacer(1, 8))
                story.append(Paragraph("Planetary positions", styles["Heading3"]))
                table_data = [["Body", "Sign", "Degree", "House", "Rx"]]
                for row in points:
                    table_data.append(
                        [
                            row.get("name", ""),
                            row.get("sign", ""),
                            row.get("degree", ""),
                            row.get("house", ""),
                            "R" if row.get("retrograde") else "",
                        ]
                    )
                table = Table(table_data, repeatRows=1)
                table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ]
                    )
                )
                story.append(table)

            houses = subject.get("houses", [])
            if houses:
                story.append(Spacer(1, 8))
                story.append(Paragraph("Houses", styles["Heading3"]))
                table_data = [["House", "Sign", "Degree"]]
                for row in houses:
                    table_data.append(
                        [row.get("name", ""), row.get("sign", ""), row.get("degree", "")]
                    )
                table = Table(table_data, repeatRows=1)
                table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ]
                    )
                )
                story.append(table)

            aspects = subject.get("aspects", {})
            aspect_rows = aspects.get("rows") or []
            if aspect_rows:
                story.append(Spacer(1, 8))
                story.append(Paragraph("Aspects", styles["Heading3"]))
                summary = aspects.get("summary") or {}
                if summary:
                    summary_text = (
                        f"Total: {summary.get('total', 0)} "
                        f"(Applying: {summary.get('applying', 0)}, Separating: {summary.get('separating', 0)}, Fixed: {summary.get('fixed', 0)})"
                    )
                    story.append(Paragraph(summary_text, styles["BodyText"]))
                table_data = [["Point A", "Aspect", "Point B", "Orb", "Movement"]]
                for row in aspect_rows:
                    table_data.append(
                        [
                            row.get("left", ""),
                            row.get("aspect", ""),
                            row.get("right", ""),
                            str(row.get("orb", "")),
                            row.get("movement", ""),
                        ]
                    )
                table = Table(table_data, repeatRows=1)
                table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ]
                    )
                )
                story.append(table)

        synastry = report.get("synastry")
        if synastry and synastry.get("rows"):
            story.append(Spacer(1, 14))
            story.append(Paragraph("Synastry aspects", styles["Heading2"]))
            if synastry.get("title"):
                story.append(Paragraph(str(synastry["title"]), styles["BodyText"]))
            summary = synastry.get("summary") or {}
            if summary:
                summary_text = (
                    f"Total: {summary.get('total', 0)} "
                    f"(Applying: {summary.get('applying', 0)}, Separating: {summary.get('separating', 0)}, Fixed: {summary.get('fixed', 0)})"
                )
                story.append(Paragraph(summary_text, styles["BodyText"]))
                closest = summary.get("closest") or []
                if closest:
                    bullet_lines = [
                        f"{item.get('left','')} {item.get('aspect','')} {item.get('right','')} (orb {item.get('orb','')}, {item.get('movement','')})"
                        for item in closest
                    ]
                    story.append(Paragraph("Tightest aspects:", styles["BodyText"]))
                    story.append(Paragraph("<br/>".join(bullet_lines), styles["BodyText"]))
            table_data = [["Inner", "Aspect", "Outer", "Orb", "Movement"]]
            for row in synastry["rows"]:
                table_data.append(
                    [
                        row.get("left", ""),
                        row.get("aspect", ""),
                        row.get("right", ""),
                        str(row.get("orb", "")),
                        row.get("movement", ""),
                    ]
                )
            table = Table(table_data, repeatRows=1)
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ]
                )
            )
            story.append(table)

        try:
            doc.build(story)
        except LayoutError:
            # Fallback to a simple text-based PDF if layout fails.
            markdown = report.get("markdown") or render_markdown_report(report)
            return render_report_text_pdf(markdown, filename_prefix=filename_prefix)

        return pdf_path.read_bytes()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

def normalize_svg_colors(svg_text: str) -> str:
    """
    Resolve CSS var() references while preserving the original styling and colors.
    We avoid injecting custom styles to keep the chart appearance intact.
    """
    css_vars = dict(re.findall(r"--([\w-]+)\s*:\s*([^;]+);", svg_text))

    def replace_var(match: re.Match[str]) -> str:
        key = match.group(1)
        # match keys with and without leading dashes
        value = css_vars.get(key.lstrip("-")) or css_vars.get(key)
        return value.strip() if value else match.group(0)

    return re.sub(r"var\((--[-a-zA-Z0-9_]+)\)", replace_var, svg_text)


def transform_report_text(report_text: str) -> str:
    """
    Prepare report text for PDF: replace glyphs, normalize, and wrap lines.
    """
    glyph_map = {
        "☉": "Sun",
        "☽": "Moon",
        "☿": "Mercury",
        "♀": "Venus",
        "♂": "Mars",
        "♃": "Jupiter",
        "♄": "Saturn",
        "♅": "Uranus",
        "♆": "Neptune",
        "♇": "Pluto",
        "☊": "Node",
        "☋": "Node",
        "♈": "Aries",
        "♉": "Taurus",
        "♊": "Gemini",
        "♋": "Cancer",
        "♌": "Leo",
        "♍": "Virgo",
        "♎": "Libra",
        "♏": "Scorpio",
        "♐": "Sagittarius",
        "♑": "Capricorn",
        "♒": "Aquarius",
        "♓": "Pisces",
    }

    def replace_glyphs(text: str) -> str:
        for glyph, word in glyph_map.items():
            text = text.replace(glyph, word)
        return text

    cleaned = replace_glyphs(report_text)
    wrapped_lines: list[str] = []
    for line in cleaned.splitlines():
        line = line.expandtabs(2)
        for chunk in textwrap.wrap(line, width=100) or [""]:
            wrapped_lines.append(chunk)
    return "\n".join(wrapped_lines)


def render_pdf_from_svg(svg_text: str, filename_prefix: str = "chart") -> bytes:
    """
    Render a PDF that embeds only the chart (converted to PNG) with no report text.
    """
    tmp_dir = Path(tempfile.mkdtemp(prefix="kerykeion_pdf_"))
    try:
        pdf_path = tmp_dir / f"{filename_prefix}.pdf"
        fixed_svg = normalize_svg_colors(svg_text)

        # First try to convert SVG directly to PDF (vector) for maximum quality and native styling.
        try:
            pdf_bytes = cairosvg.svg2pdf(bytestring=fixed_svg.encode("utf-8"), dpi=300, unsafe=True)
            (tmp_dir / f"{filename_prefix}.pdf").write_bytes(pdf_bytes)
            return pdf_bytes
        except Exception:
            pass

        png_bytes: Optional[bytes] = None
        try:
            png_bytes = cairosvg.svg2png(bytestring=fixed_svg.encode("utf-8"), dpi=300, unsafe=True)
        except Exception:
            try:
                svg_path = tmp_dir / f"{filename_prefix}.svg"
                svg_path.write_text(fixed_svg, encoding="utf-8")
                drawing = svg2rlg(str(svg_path))
                renderPDF.drawToFile(drawing, str(tmp_dir / "tmp.pdf"))
            except Exception:
                png_bytes = None

        story = []
        if png_bytes:
            try:
                img = Image(BytesIO(png_bytes))
                img._restrictSize(7.5 * inch, 9.0 * inch)
                story.append(img)
            except Exception:
                pass

        doc = SimpleDocTemplate(str(pdf_path), pagesize=letter, leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=40)
        try:
            doc.build(story)
        except Exception:
            # Fallback: draw directly onto canvas
            c = canvas.Canvas(str(pdf_path), pagesize=letter)
            width, height = letter
            if png_bytes:
                try:
                    reader = ImageReader(BytesIO(png_bytes))
                    iw, ih = reader.getSize()
                    scale = min((width - 80) / iw, (height - 80) / ih, 1.0)
                    c.drawImage(
                        reader,
                        40,
                        40,
                        width=iw * scale,
                        height=ih * scale,
                        preserveAspectRatio=True,
                        mask="auto",
                    )
                except Exception:
                    pass
            c.save()

        return pdf_path.read_bytes()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def compute_dual_chart_aspects(
    first: BirthData,
    second: BirthData,
    config: Optional[ChartConfig],
):
    """
    Convenience wrapper for Kerykeion AspectsFactory.dual_chart_aspects().

    Returns a tuple: (first_subject, second_subject, aspects_model).
    """
    cfg = ensure_config(config)
    first_subject = build_subject(first, cfg)
    second_subject = build_subject(second, cfg)
    aspects_model = AspectsFactory.dual_chart_aspects(first_subject, second_subject)
    return first_subject, second_subject, aspects_model
