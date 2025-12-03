from fastapi import APIRouter

from schemas import TransitMomentRequest, TransitResponse, TransitSnapshot, BirthData
from aspects.ascendant_range import compute_ascendant_day_range
from aspects.moon_range import compute_moon_month_range
from utils import build_subject, compute_major_aspects, compute_normal_aspects, ensure_config, to_local_datetime

router = APIRouter(tags=["transit"])


@router.post("/transit", response_model=TransitResponse)
async def transit_snapshot(payload: TransitMomentRequest) -> TransitResponse:
    """
    Compute a transit snapshot for a given moment.

    The request does not require a `name` for the transit moment; instead,
    the server assigns an internal label ("Transit") when constructing the
    underlying Kerykeion subject.

    When `birth` is provided, the corresponding natal chart is evaluated using
    the same configuration and returned as `natal_subject`.
    """
    print("POST /transit", payload.dict(exclude_none=True))
    cfg = ensure_config(payload.config)

    # Convert transit moment input (no name) into a BirthData-like structure.
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
    transit_dict = transit_subject.model_dump(mode="json")
    transit_aspects = compute_normal_aspects(transit_subject)
    transit_major_aspects = compute_major_aspects(transit_dict, active_points=cfg.active_points)

    natal_dict = None
    natal_aspects = None
    natal_major_aspects = None
    if payload.birth is not None:
        natal_subject = build_subject(payload.birth, cfg)
        natal_dict = natal_subject.model_dump(mode="json")
        natal_aspects = compute_normal_aspects(natal_subject)
        natal_major_aspects = compute_major_aspects(natal_dict, active_points=cfg.active_points)

    timestamp = to_local_datetime(moment_birth)
    ascendant_day_range = []
    moon_month_range = []
    if payload.ascendant_range_enabled:
        ascendant_day_range.append(
            compute_ascendant_day_range(
                moment_birth,
                cfg,
                timestamp,
                identifier="transit",
                label="Transit",
            )
        )
        if payload.birth is not None:
            natal_anchor = to_local_datetime(payload.birth)
            ascendant_day_range.append(
                compute_ascendant_day_range(
                    payload.birth,
                    cfg,
                    natal_anchor,
                    identifier="natal",
                    label=payload.birth.name or "Natal",
                )
            )
    if payload.moon_range_enabled:
        moon_month_range.append(
            compute_moon_month_range(
                moment_birth,
                cfg,
                timestamp,
                identifier="transit",
                label="Transit",
            )
        )
        if payload.birth is not None:
            natal_anchor = to_local_datetime(payload.birth)
            moon_month_range.append(
                compute_moon_month_range(
                    payload.birth,
                    cfg,
                    natal_anchor,
                    identifier="natal",
                    label=payload.birth.name or "Natal",
                )
            )

    snapshot = TransitSnapshot(
        timestamp=timestamp,
        subject=transit_dict,
        aspects=transit_aspects,
        major_aspects=transit_major_aspects,
        natal_subject=natal_dict,
        natal_aspects=natal_aspects,
        natal_major_aspects=natal_major_aspects,
        ascendant_day_range=ascendant_day_range,
        moon_month_range=moon_month_range,
    )
    return TransitResponse(
        snapshot=snapshot,
        ascendant_day_range=ascendant_day_range,
        moon_month_range=moon_month_range,
    )
