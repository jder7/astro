from __future__ import annotations

from contextlib import redirect_stdout
from datetime import datetime, timedelta
from io import StringIO, BytesIO
from pathlib import Path
import shutil
import tempfile
from typing import Generator, Optional
from zoneinfo import ZoneInfo
from calendar import monthrange
import re
import textwrap

from kerykeion import AstrologicalSubjectFactory, ReportGenerator, AspectsFactory  # type: ignore
from kerykeion.chart_data_factory import ChartDataFactory  # type: ignore
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

from enums import RangeGranularity, ZodiacType, ReportKind
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


def generate_report_text(request: ReportRequest) -> str:
    """
    Generate a plain-text report using Kerykeion's ReportGenerator.

    This helper captures stdout from ReportGenerator.print_report() and returns it as a string.
    """
    cfg = ensure_config(request.config)
    subject = build_subject(request.birth, cfg)

    # Build the appropriate input to ReportGenerator depending on the kind.
    if request.kind == ReportKind.SUBJECT:
        target = subject
    else:
        # NATAL chart data with aspects
        chart_data = ChartDataFactory.create_natal_chart_data(subject)
        target = chart_data

    generator = ReportGenerator(target)

    buffer = StringIO()
    with redirect_stdout(buffer):
        # Both arguments are supported according to Kerykeion docs;
        # SUBJECT + include_aspects, NATAL + max_aspects.
        generator.print_report(
            include_aspects=request.include_aspects,
            max_aspects=request.max_aspects,
        )

    return buffer.getvalue()


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
