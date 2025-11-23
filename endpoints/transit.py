from fastapi import APIRouter

from schemas import (
    TransitMomentRequest,
    TransitResponse,
    TransitSnapshot,
    BirthData,
)
from utils import build_subject, ensure_config, to_local_datetime

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

    natal_dict = None
    if payload.birth is not None:
        natal_subject = build_subject(payload.birth, cfg)
        natal_dict = natal_subject.model_dump(mode="json")

    timestamp = to_local_datetime(moment_birth)

    snapshot = TransitSnapshot(
        timestamp=timestamp,
        subject=transit_dict,
        natal_subject=natal_dict,
    )
    return TransitResponse(snapshot=snapshot)
