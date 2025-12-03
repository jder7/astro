from fastapi import APIRouter

from schemas import RelationshipRequest, RelationshipResponse
from aspects.ascendant_range import compute_ascendant_day_range
from aspects.moon_range import compute_moon_month_range
from utils import compute_dual_chart_aspects, ensure_config, to_local_datetime

router = APIRouter(tags=["relationship"])


@router.post("/relationship", response_model=RelationshipResponse)
async def relationship(payload: RelationshipRequest) -> RelationshipResponse:
    """
    Compute dual-chart aspects between two subjects.

    Returns both AstrologicalSubject JSON dumps plus the dual-chart aspects model.
    """
    print("POST /relationship", payload.dict(exclude_none=True))
    cfg = ensure_config(payload.config)
    first_subject, second_subject, aspects_model = compute_dual_chart_aspects(
        payload.first,
        payload.second,
        cfg,
    )

    ascendant_day_range = []
    moon_month_range = []
    if payload.ascendant_range_enabled:
        ascendant_day_range.append(
            compute_ascendant_day_range(
                payload.first,
                cfg,
                to_local_datetime(payload.first),
                identifier="first",
                label=payload.first.name or "Partner A",
            )
        )
        ascendant_day_range.append(
            compute_ascendant_day_range(
                payload.second,
                cfg,
                to_local_datetime(payload.second),
                identifier="second",
                label=payload.second.name or "Partner B",
            )
        )
    if payload.moon_range_enabled:
        moon_month_range.append(
            compute_moon_month_range(
                payload.first,
                cfg,
                to_local_datetime(payload.first),
                identifier="first",
                label=payload.first.name or "Partner A",
            )
        )
        moon_month_range.append(
            compute_moon_month_range(
                payload.second,
                cfg,
                to_local_datetime(payload.second),
                identifier="second",
                label=payload.second.name or "Partner B",
            )
        )

    return RelationshipResponse(
        first_subject=first_subject.model_dump(mode="json"),
        second_subject=second_subject.model_dump(mode="json"),
        aspects=aspects_model.model_dump(mode="json"),
        ascendant_day_range=ascendant_day_range,
        moon_month_range=moon_month_range,
    )
