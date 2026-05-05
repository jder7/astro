from datetime import timedelta

from fastapi import APIRouter

from service.schemas import (
    BirthData,
    ChartConfig,
    TransitEndInput,
    TransitMomentInput,
)
from service.utils import ensure_config
from service.utils.ranges import to_local_datetime
from service.aspects.timeline_spans import compute_range_aspect_spans
from service.aspects.timeline_spans_kinematic import compute_kinematic_range_aspect_spans

router = APIRouter(tags=["transit"])


def _birth_from_moment(moment: TransitMomentInput, name: str = "Span reference") -> BirthData:
    return BirthData(
        name=name,
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


def _compute_aspect_spans_response(payload: dict, compute_fn, engine: str) -> dict:
    moment_raw = payload.get("moment", {})
    end_raw = payload.get("end", {})
    config_raw = payload.get("config", {})
    birth_raw = payload.get("birth")

    moment = TransitMomentInput(**moment_raw) if isinstance(moment_raw, dict) else TransitMomentInput()
    end = TransitEndInput(**end_raw) if isinstance(end_raw, dict) else TransitEndInput()
    cfg = ensure_config(ChartConfig(**config_raw) if isinstance(config_raw, dict) else ChartConfig())
    birth = BirthData(**birth_raw) if isinstance(birth_raw, dict) else None
    mode = str(payload.get("mode") or ("natal_transit" if birth else "transit"))

    start_base = _birth_from_moment(moment)
    end_base = BirthData(
        name="Span range end",
        year=end.year,
        month=end.month,
        day=end.day,
        hour=end.hour,
        minute=end.minute,
        lng=moment.lng,
        lat=moment.lat,
        tz_str=moment.tz_str,
        city=moment.city,
        nation=moment.nation,
    )
    start_dt = to_local_datetime(start_base)
    end_dt = to_local_datetime(end_base)
    if not isinstance(end_raw, dict) or not end_raw:
        end_dt = start_dt + timedelta(days=30)
    if end_dt < start_dt:
        start_dt, end_dt = end_dt, start_dt

    result = compute_fn(
        transit_base=start_base,
        cfg=cfg,
        start_dt=start_dt,
        end_dt=end_dt,
        mode=mode,
        birth=birth,
    )

    spans = result["spans"]
    for span in spans:
        if isinstance(span, dict):
            span.setdefault("engine", result.get("engine", engine))

    return {
        "timestamp": result["start"],
        "start": result["start"],
        "end": result["end"],
        "mode": result["mode"],
        "engine": result.get("engine", engine),
        "aspects_count": result["spans_count"],
        "spans_count": result["spans_count"],
        "candidate_pairs": result["candidate_pairs"],
        "points_count": result["points_count"],
        "timestamps_evaluated": result["timestamps_evaluated"],
        "spans": spans,
    }


@router.post("/aspect-spans")
async def aspect_spans(payload: dict) -> dict:
    """
    Compute range-native aspect lifecycle spans for the advanced timeline.

    The request mirrors TransitRangeRequest and adds `mode`. Supported modes:
    - transit: moving transit points against each other
    - natal_transit: fixed natal points against moving transit points
    """
    return _compute_aspect_spans_response(payload, compute_range_aspect_spans, "scan")


@router.post("/aspect-spans-kinematic")
async def aspect_spans_kinematic(payload: dict) -> dict:
    """
    Experimental range-native aspect lifecycle spans using local relative
    velocity to predict enter/exact/exit boundaries.
    """
    return _compute_aspect_spans_response(payload, compute_kinematic_range_aspect_spans, "kinematic")
