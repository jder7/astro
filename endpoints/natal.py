from fastapi import APIRouter

from schemas import NatalRequest, NatalResponse
from aspects.ascendant_range import compute_ascendant_day_range
from aspects.moon_range import compute_moon_month_range
from aspects.sun_range import compute_sun_year_range
from utils import build_subject, compute_major_aspects, compute_normal_aspects, ensure_config, to_local_datetime

router = APIRouter(tags=["natal"])


@router.post("/natal", response_model=NatalResponse)
async def natal_chart(payload: NatalRequest) -> NatalResponse:
    """
    Compute a natal chart configuration as a structured JSON response.
    """
    print("POST /natal", payload.dict(exclude_none=True))
    cfg = ensure_config(payload.config)
    subject = build_subject(payload.birth, cfg)
    subject_dict = subject.model_dump(mode="json")
    aspects = compute_normal_aspects(subject)
    major_aspects = compute_major_aspects(subject_dict, active_points=cfg.active_points)
    anchor_dt = to_local_datetime(payload.birth)
    ascendant_day_range = []
    moon_month_range = []
    sun_year_range = []
    if payload.asc_moon_sun_range_enabled:
        ascendant_day_range.append(
            compute_ascendant_day_range(
                payload.birth,
                cfg,
                anchor_dt,
                identifier="natal",
                label=payload.birth.name or "Natal",
            )
        )
        moon_month_range.append(
            compute_moon_month_range(
                payload.birth,
                cfg,
                anchor_dt,
                identifier="natal",
                label=payload.birth.name or "Natal",
            )
        )
        sun_year_range.append(
            compute_sun_year_range(
                payload.birth,
                cfg,
                anchor_dt,
                identifier="natal",
                label=payload.birth.name or "Natal",
            )
        )
    return NatalResponse(
        subject=subject_dict,
        aspects=aspects,
        major_aspects=major_aspects,
        ascendant_day_range=ascendant_day_range,
        moon_month_range=moon_month_range,
        sun_year_range=sun_year_range,
    )
