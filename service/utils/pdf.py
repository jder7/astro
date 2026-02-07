from __future__ import annotations

from io import BytesIO
from pathlib import Path
import shutil
import tempfile
from typing import Optional
import textwrap

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

from .svg import normalize_svg_colors


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
                table_data = [["Inner", "Aspect", "Outer", "Orb", "Movement"]]
                for row in aspect_rows:
                    table_data.append(
                        [
                            row.get("left", ""),
                            row.get("aspect", ""),
                            row.get("right", ""),
                            row.get("orb", ""),
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
            story.append(Spacer(1, 10))
            story.append(Paragraph("Synastry", styles["Heading2"]))
            if synastry.get("title"):
                story.append(Paragraph(synastry["title"], styles["BodyText"]))
            summary = synastry.get("summary") or {}
            if summary:
                summary_text = (
                    f"Total: {summary.get('total', 0)} "
                    f"(Applying: {summary.get('applying', 0)}, Separating: {summary.get('separating', 0)}, "
                    f"Fixed: {summary.get('fixed', 0)})"
                )
                story.append(Paragraph(summary_text, styles["BodyText"]))
            tightest = summary.get("tightest") or []
            if tightest:
                story.append(Spacer(1, 6))
                story.append(Paragraph("Tightest aspects:", styles["BodyText"]))
                for row in tightest:
                    orb = row.get("orb") or ""
                    movement = row.get("movement") or ""
                    movement = f", {movement}" if movement else ""
                    left = row.get("left", "")
                    right = row.get("right", "")
                    aspect = row.get("aspect", "aspect")
                    story.append(
                        Paragraph(f"• {left} in {aspect} with {right} (orb {orb}{movement})", styles["BodyText"])
                    )
            table_data = [["Inner", "Aspect", "Outer", "Orb", "Movement"]]
            for row in synastry.get("rows", []):
                table_data.append(
                    [
                        row.get("left", ""),
                        row.get("aspect", ""),
                        row.get("right", ""),
                        row.get("orb", ""),
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
            from .reports import render_markdown_report

            markdown = report.get("markdown") or render_markdown_report(report)
            return render_report_text_pdf(markdown, filename_prefix=filename_prefix)

        return pdf_path.read_bytes()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


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
            pass

        if not png_bytes:
            drawing = svg2rlg(BytesIO(fixed_svg.encode("utf-8")))
            if drawing is None:
                raise ValueError("Unable to parse SVG for PDF output.")
            renderPDF.drawToFile(drawing, str(pdf_path))
            return pdf_path.read_bytes()

        png_reader = ImageReader(BytesIO(png_bytes))
        img_width, img_height = png_reader.getSize()
        page_width, page_height = letter
        scale = min(page_width / img_width, page_height / img_height) * 0.92
        img_w = img_width * scale
        img_h = img_height * scale
        x = (page_width - img_w) / 2
        y = (page_height - img_h) / 2

        c = canvas.Canvas(str(pdf_path), pagesize=letter)
        c.drawImage(png_reader, x, y, width=img_w, height=img_h, preserveAspectRatio=True, mask="auto")
        c.save()
        return pdf_path.read_bytes()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
