from fastapi import APIRouter, Response

from schemas import NatalRequest
from utils import build_subject, ensure_config, render_svg_to_string

from kerykeion.chart_data_factory import ChartDataFactory  # type: ignore
from kerykeion.charts.chart_drawer import ChartDrawer  # type: ignore

router = APIRouter(tags=["svg"])


@router.post("/svg/natal", response_class=Response)
async def natal_svg(payload: NatalRequest) -> Response:
    """
    Generate a natal SVG chart.

    The chart theme is configured via `config.theme` and mapped directly to
    Kerykeion's ChartDrawer `theme` parameter.
    """
    cfg = ensure_config(payload.config)
    subject = build_subject(payload.birth, cfg)

    chart_data = ChartDataFactory.create_natal_chart_data(subject)
    drawer = ChartDrawer(chart_data=chart_data, theme=cfg.theme.value)

    svg = render_svg_to_string(drawer, filename_prefix="natal")
    return Response(content=svg, media_type="image/svg+xml")
