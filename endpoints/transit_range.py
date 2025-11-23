from typing import List

from fastapi import APIRouter

from schemas import (
    TransitRangeRequest,
    TransitRangeResponse,
    TransitSnapshot,
    BirthData,
)
from utils import (
    ensure_config,
    build_subject,
    build_subject_for_moment,
    to_local_datetime,
    iter_range_datetimes,
)

router = APIRouter(tags=["transit"])


@router.post("/transit-range", response_model=TransitRangeResponse)
async def transit_range(payload: TransitRangeRequest) -> TransitRangeResponse:
    """
    Compute a sequence of transit snapshots between two moments.

    The input uses a single transit-style `moment` (date/time/location) plus an
    `end` date/time. Location (lat, lng, tz, city, nation) from `moment` is
    reused across the entire range.
    """
    cfg = ensure_config(payload.config)

    # Build BirthData representations for the start and end timestamps.
    m = payload.moment
    start_birth = BirthData(
        name="Transit start",
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

    e = payload.end
    end_birth = BirthData(
        name="Transit end",
        year=e.year,
        month=e.month,
        day=e.day,
        hour=e.hour,
        minute=e.minute,
        lng=m.lng,
        lat=m.lat,
        tz_str=m.tz_str,
        city=m.city,
        nation=m.nation,
    )

    start_dt = to_local_datetime(start_birth)
    end_dt = to_local_datetime(end_birth)

    snapshots: List[TransitSnapshot] = []
    natal_dict_cached = None

    for dt in iter_range_datetimes(start_dt, end_dt, payload.granularity):
        moment_subject = build_subject_for_moment(start_birth, dt, cfg)
        moment_dict = moment_subject.model_dump(mode="json")

        natal_dict = None
        if payload.birth is not None:
            # Natal chart is time-independent; compute it once and reuse.
            if natal_dict_cached is None:
                natal_subject = build_subject(payload.birth, cfg)
                natal_dict_cached = natal_subject.model_dump(mode="json")
            natal_dict = natal_dict_cached

        snapshot = TransitSnapshot(
            timestamp=dt,
            subject=moment_dict,
            natal_subject=natal_dict,
        )
        snapshots.append(snapshot)

    return TransitRangeResponse(snapshots=snapshots)
