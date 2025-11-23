from fastapi import APIRouter, Response

from schemas import SynastrySvgRequest
from utils import build_subject, ensure_config, render_svg_to_string

from kerykeion.chart_data_factory import ChartDataFactory  # type: ignore
from kerykeion.charts.chart_drawer import ChartDrawer  # type: ignore

router = APIRouter(tags=["svg"])


@router.post("/svg/synastry", response_class=Response)
async def synastry_svg(payload: SynastrySvgRequest) -> Response:
    """
    Generate a synastry SVG chart between two subjects.

    When `grid_view` is true, this uses Kerykeion's double-chart aspect grid
    rendered as a table. The visual theme is controlled via `config.theme`.
    """
    cfg = ensure_config(payload.config)

    first_subject = build_subject(payload.first, cfg)
    second_subject = build_subject(payload.second, cfg)

    chart_data = ChartDataFactory.create_synastry_chart_data(
        first_subject,
        second_subject,
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
