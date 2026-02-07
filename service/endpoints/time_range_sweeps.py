from fastapi import APIRouter, HTTPException, status

from service.enums import Mode, RangeTarget
from service.schemas import BirthData, RangeRequest, RangeResponse
from service.aspects.point_range import compute_point_sign_range
from service.utils import ensure_config, to_local_datetime

router = APIRouter(tags=["time-range-sweeps"])


def _append_ranges(
    *,
    base: BirthData,
    cfg,
    anchor,
    identifier: str,
    label: str,
    targets: set[RangeTarget],
    point_sign_range: list,
) -> None:
    for target in targets:
        point_sign_range.append(
            compute_point_sign_range(
                base,
                cfg,
                anchor,
                point_key=target,
                identifier=identifier,
                label=label,
            )
        )


def _moment_to_birth(moment) -> BirthData:
    return BirthData(
        name="Transit",
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


@router.post("/timeRangeSweeps", response_model=RangeResponse)
async def chart_ranges(payload: RangeRequest) -> RangeResponse:
    """
    Compute ascendant, Moon, and/or Sun ranges on demand.
    """
    print("POST /timeRangeSweeps", payload.model_dump(exclude_none=True))
    cfg = ensure_config(payload.config)

    targets = set(payload.targets or [])
    if not targets:
        targets = {RangeTarget.ASCENDANT, RangeTarget.MOON, RangeTarget.SUN}

    point_sign_range = []

    if payload.mode == Mode.NATAL:
        if payload.birth is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="birth is required for natal range requests.",
            )
        anchor = to_local_datetime(payload.birth)
        _append_ranges(
            base=payload.birth,
            cfg=cfg,
            anchor=anchor,
            identifier="natal",
            label=payload.birth.name or "Natal",
            targets=targets,
            point_sign_range=point_sign_range,
        )
    elif payload.mode in {Mode.TRANSIT, Mode.NATAL_TRANSIT}:
        if payload.moment is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="moment is required for transit range requests.",
            )
        moment_birth = _moment_to_birth(payload.moment)
        transit_anchor = to_local_datetime(moment_birth)
        _append_ranges(
            base=moment_birth,
            cfg=cfg,
            anchor=transit_anchor,
            identifier="transit",
            label="Transit",
            targets=targets,
            point_sign_range=point_sign_range,
        )

        if payload.birth is None and payload.mode == Mode.NATAL_TRANSIT:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="birth is required for natal_transit range requests.",
            )

        if payload.birth is not None:
            natal_anchor = to_local_datetime(payload.birth)
            _append_ranges(
                base=payload.birth,
                cfg=cfg,
                anchor=natal_anchor,
                identifier="natal",
                label=payload.birth.name or "Natal",
                targets=targets,
                point_sign_range=point_sign_range,
            )
    elif payload.mode == Mode.RELATIONSHIP:
        if payload.first is None or payload.second is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="first and second are required for relationship range requests.",
            )
        first_anchor = to_local_datetime(payload.first)
        _append_ranges(
            base=payload.first,
            cfg=cfg,
            anchor=first_anchor,
            identifier="first",
            label=payload.first.name or "Partner A",
            targets=targets,
            point_sign_range=point_sign_range,
        )
        second_anchor = to_local_datetime(payload.second)
        _append_ranges(
            base=payload.second,
            cfg=cfg,
            anchor=second_anchor,
            identifier="second",
            label=payload.second.name or "Partner B",
            targets=targets,
            point_sign_range=point_sign_range,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported mode for ranges: {payload.mode}",
        )

    return RangeResponse(
        point_sign_range=point_sign_range,
    )
