from fastapi import APIRouter, Response

from schemas import (
    NatalRequest,
    TransitMomentRequest,
    SynastrySvgRequest,
    SvgPdfRequest,
    BirthData,
)
from utils import build_subject, ensure_config, render_svg_to_string, render_pdf_from_svg

from kerykeion.chart_data_factory import ChartDataFactory  # type: ignore
from kerykeion.charts.chart_drawer import ChartDrawer  # type: ignore

router = APIRouter(tags=["svg"])


@router.post("/svg/natal", response_class=Response)
async def natal_svg(payload: NatalRequest) -> Response:
    print("POST /svg/natal", payload.dict(exclude_none=True))
    cfg = ensure_config(payload.config)
    subject = build_subject(payload.birth, cfg)
    chart_data = ChartDataFactory.create_natal_chart_data(subject, active_points=cfg.active_points)
    drawer = ChartDrawer(chart_data=chart_data, theme=cfg.theme.value)
    svg = render_svg_to_string(drawer, filename_prefix="natal")
    return Response(content=svg, media_type="image/svg+xml")


@router.post("/svg/transit", response_class=Response)
async def transit_svg(payload: TransitMomentRequest) -> Response:
    print("POST /svg/transit", payload.dict(exclude_none=True))
    cfg = ensure_config(payload.config)
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
    transit_subject = build_subject(moment_birth, cfg)

    if payload.birth is not None:
        natal_subject = build_subject(payload.birth, cfg)
        chart_data = ChartDataFactory.create_transit_chart_data(
            natal_subject,
            transit_subject,
            active_points=cfg.active_points,
        )
        drawer = ChartDrawer(chart_data=chart_data, theme=cfg.theme.value)
        filename_prefix = "transit-dual"
    else:
        chart_data = ChartDataFactory.create_natal_chart_data(transit_subject, active_points=cfg.active_points)
        drawer = ChartDrawer(chart_data=chart_data, theme=cfg.theme.value)
        filename_prefix = "transit"

    svg = render_svg_to_string(drawer, filename_prefix=filename_prefix)
    return Response(content=svg, media_type="image/svg+xml")


@router.post("/svg/synastry", response_class=Response)
async def synastry_svg(payload: SynastrySvgRequest) -> Response:
    print("POST /svg/synastry", payload.dict(exclude_none=True))
    cfg = ensure_config(payload.config)
    first_subject = build_subject(payload.first, cfg)
    second_subject = build_subject(payload.second, cfg)

    chart_data = ChartDataFactory.create_synastry_chart_data(
        first_subject,
        second_subject,
        active_points=cfg.active_points,
    )

    if payload.grid_view:
        drawer = ChartDrawer(
            chart_data=chart_data,
            double_chart_aspect_grid_type="table",
            theme=cfg.theme.value,
        )
        filename_prefix = "synastry-grid"
    else:
        drawer = ChartDrawer(chart_data=chart_data, theme=cfg.theme.value)
        filename_prefix = "synastry"

    svg = render_svg_to_string(drawer, filename_prefix=filename_prefix)
    return Response(content=svg, media_type="image/svg+xml")


@router.post("/svg/pdf", response_class=Response)
async def svg_pdf(payload: SvgPdfRequest) -> Response:
    """
    Generate a PDF from chart data for natal, transit (single or dual), or relationship (synastry).
    """
    print("POST /svg/pdf", payload.dict(exclude_none=True))
    cfg = ensure_config(payload.config)

    mode = payload.mode
    svg_text = ""

    if mode == "natal":
        if not payload.birth:
            return Response(status_code=400, content="Natal mode requires birth.")
        subject = build_subject(payload.birth, cfg)
        chart_data = ChartDataFactory.create_natal_chart_data(subject)
        drawer = ChartDrawer(chart_data=chart_data, theme=cfg.theme.value)
        svg_text = render_svg_to_string(drawer, filename_prefix="natal")
    elif mode == "transit":
        if not payload.moment:
            return Response(status_code=400, content="Transit mode requires a moment.")
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
        transit_subject = build_subject(moment_birth, cfg)
        if payload.birth:
            natal_subject = build_subject(payload.birth, cfg)
            chart_data = ChartDataFactory.create_transit_chart_data(
                natal_subject,
                transit_subject,
                active_points=cfg.active_points,
            )
            filename_prefix = "transit-dual"
        else:
            chart_data = ChartDataFactory.create_natal_chart_data(transit_subject, active_points=cfg.active_points)
            filename_prefix = "transit"
        drawer = ChartDrawer(chart_data=chart_data, theme=cfg.theme.value)
        svg_text = render_svg_to_string(drawer, filename_prefix=filename_prefix)
    elif mode == "relationship":
        if not (payload.first and payload.second):
            return Response(status_code=400, content="Relationship mode requires first and second.")
        first_subject = build_subject(payload.first, cfg)
        second_subject = build_subject(payload.second, cfg)
        chart_data = ChartDataFactory.create_synastry_chart_data(
            first_subject,
            second_subject,
        )
        drawer = ChartDrawer(
            chart_data=chart_data,
            double_chart_aspect_grid_type="table" if payload.grid_view else None,
            theme=cfg.theme.value,
        )
        filename_prefix = "relationship"
        svg_text = render_svg_to_string(drawer, filename_prefix=filename_prefix)
    else:  # natal_transit dual wheel
        if not (payload.birth and payload.moment):
            return Response(status_code=400, content="Dual mode requires birth and moment.")
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
        filename_prefix = "dual"
        svg_text = render_svg_to_string(drawer, filename_prefix=filename_prefix)

    pdf_bytes = render_pdf_from_svg(svg_text, filename_prefix=mode)
    headers = {"Content-Disposition": f'attachment; filename="{mode}-chart.pdf"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
