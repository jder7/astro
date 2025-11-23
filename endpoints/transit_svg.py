from fastapi import APIRouter, Response

from schemas import TransitMomentRequest, BirthData
from utils import build_subject, ensure_config, render_svg_to_string

from kerykeion.chart_data_factory import ChartDataFactory  # type: ignore
from kerykeion.charts.chart_drawer import ChartDrawer  # type: ignore

router = APIRouter(tags=["svg"])


@router.post("/svg/transit", response_class=Response)
async def transit_svg(payload: TransitMomentRequest) -> Response:
    """
    Generate a transit SVG chart.

    - If `birth` is omitted: a single-wheel chart for the transit moment.
    - If `birth` is provided: a dual-wheel transit chart relative to the natal chart.

    The chart theme is configured via `config.theme` and mapped directly to
    Kerykeion's ChartDrawer `theme` parameter.
    """
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
        # Dual-wheel transit chart relative to the natal chart.
        natal_subject = build_subject(payload.birth, cfg)
        chart_data = ChartDataFactory.create_transit_chart_data(
            natal_subject,
            transit_subject,
        )
        drawer = ChartDrawer(chart_data=chart_data, theme=cfg.theme.value)
        filename_prefix = "transit-dual"
    else:
        # Single-wheel chart: treat the transit snapshot as standalone.
        chart_data = ChartDataFactory.create_natal_chart_data(transit_subject)
        drawer = ChartDrawer(chart_data=chart_data, theme=cfg.theme.value)
        filename_prefix = "transit"

    svg = render_svg_to_string(drawer, filename_prefix=filename_prefix)
    return Response(content=svg, media_type="image/svg+xml")
