from fastapi import APIRouter
from kerykeion import AspectsFactory  # type: ignore

from service.schemas import TransitMomentRequest, TransitResponse, TransitSnapshot, BirthData
from service.aspects.point_range import compute_point_sign_range
from service.utils import (
    HouseProjectionEngine,
    build_subject,
    compute_major_aspects,
    compute_normal_aspects,
    compute_synastry_major_aspects,
    ensure_config,
    to_local_datetime,
    filter_aspects_model,
)

router = APIRouter(tags=["transit"])
projection_engine = HouseProjectionEngine()


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
    print("POST /transit", payload.model_dump(exclude_none=True))
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
    transit_aspects = compute_normal_aspects(transit_subject, active_points=cfg.active_points)
    transit_major_aspects = compute_major_aspects(transit_dict, active_points=cfg.active_points)

    natal_dict = None
    natal_aspects = None
    natal_major_aspects = None
    synastry = None
    synastry_major_aspects = []
    house_projections = None
    if payload.birth is not None:
        natal_subject = build_subject(payload.birth, cfg)
        natal_dict = natal_subject.model_dump(mode="json")
        natal_aspects = compute_normal_aspects(natal_subject, active_points=cfg.active_points)
        natal_major_aspects = compute_major_aspects(natal_dict, active_points=cfg.active_points)
        synastry_model = AspectsFactory.dual_chart_aspects(transit_subject, natal_subject)
        synastry_model = filter_aspects_model(synastry_model, cfg.active_points)
        synastry = synastry_model.model_dump(mode="json")
        synastry_major_aspects = compute_synastry_major_aspects(transit_dict, natal_dict, cfg.active_points)
        house_projections = projection_engine.build_transit_response(transit_dict, natal_dict, cfg.active_points)

    timestamp = to_local_datetime(moment_birth)
    point_sign_range = []
    if payload.asc_moon_sun_range_enabled:
        for point_key in ("ascendant", "moon", "sun"):
            point_sign_range.append(
                compute_point_sign_range(
                    moment_birth,
                    cfg,
                    timestamp,
                    point_key=point_key,
                    identifier="transit",
                    label="Transit",
                )
            )
            if payload.birth is not None:
                natal_anchor = to_local_datetime(payload.birth)
                point_sign_range.append(
                    compute_point_sign_range(
                        payload.birth,
                        cfg,
                        natal_anchor,
                        point_key=point_key,
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
        synastry=synastry,
        synastry_major_aspects=synastry_major_aspects,
        house_projections=house_projections,
        point_sign_range=point_sign_range,
    )
    return TransitResponse(snapshot=snapshot)
