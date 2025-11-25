from fastapi import APIRouter, Response, Query

from schemas import ReportRequest, ReportResponse, BirthData, TransitMomentInput
from utils import generate_report_text, render_pdf_from_svg, ensure_config, build_subject, render_svg_to_string
from kerykeion.chart_data_factory import ChartDataFactory  # type: ignore
from kerykeion.charts.chart_drawer import ChartDrawer  # type: ignore

router = APIRouter(tags=["report"])


@router.post("/report", response_model=ReportResponse)
async def generate_report(payload: ReportRequest) -> ReportResponse:
    """
    Generate a plain-text report via Kerykeion's ReportGenerator.

    The report text is returned as a string (no interpretations added by this API).
    """
    text = generate_report_text(payload)
    return ReportResponse(kind=payload.kind, text=text)


@router.post("/report/pdf", response_class=Response)
async def generate_report_pdf(
    payload: ReportRequest,
    mode: str = Query(
        "natal",
        description="Report/chart mode for naming: natal | transit | natal_transit",
    ),
) -> Response:
    """
    Generate a PDF that includes the chart SVG and appended report text.

    Currently renders a natal-style chart for the provided birth data and
    applies the supplied ChartConfig to both chart and report generation.
    """
    cfg = ensure_config(payload.config)

    svg_text = ""
    if mode == "natal":
        subject = build_subject(payload.birth, cfg)
        chart_data = ChartDataFactory.create_natal_chart_data(subject)
        drawer = ChartDrawer(chart_data=chart_data, theme=cfg.theme.value)
        svg_text = render_svg_to_string(drawer, filename_prefix="report")
    elif mode == "transit":
        if not payload.moment:
            return Response(status_code=400, content="Transit mode requires a moment field.")
        m: TransitMomentInput = payload.moment
        moment_birth = BirthData(
            name="Transit",
            year=m.year,
            month=m.month,
            day=m.day,
            hour=m.hour,
            minute=m.minute,
            lng=m.lng,
            lat=m.lat,
            tz_str=m.tz_str,
            city=m.city,
            nation=m.nation,
        )
        transit_subject = build_subject(moment_birth, cfg)
        chart_data = ChartDataFactory.create_natal_chart_data(transit_subject)
        drawer = ChartDrawer(chart_data=chart_data, theme=cfg.theme.value)
        svg_text = render_svg_to_string(drawer, filename_prefix="report")
    else:  # natal_transit dual wheel
        if not payload.moment:
            return Response(status_code=400, content="Dual mode requires a moment field.")
        m = payload.moment
        moment_birth = BirthData(
            name="Transit",
            year=m.year,
            month=m.month,
            day=m.day,
            hour=m.hour,
            minute=m.minute,
            lng=m.lng,
            lat=m.lat,
            tz_str=m.tz_str,
            city=m.city,
            nation=m.nation,
        )
        natal_subject = build_subject(payload.birth, cfg)
        transit_subject = build_subject(moment_birth, cfg)
        chart_data = ChartDataFactory.create_transit_chart_data(
            natal_subject,
            transit_subject,
        )
        drawer = ChartDrawer(chart_data=chart_data, theme=cfg.theme.value)
        svg_text = render_svg_to_string(drawer, filename_prefix="report")

    pdf_bytes = render_pdf_from_svg(svg_text, filename_prefix=mode)

    headers = {
        "Content-Disposition": f'attachment; filename="{mode}-report.pdf"'
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
