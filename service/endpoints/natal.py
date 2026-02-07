from fastapi import APIRouter

from service.schemas import NatalRequest, NatalResponse
from service.aspects.point_range import compute_point_sign_range
from service.utils import build_subject, compute_major_aspects, compute_normal_aspects, ensure_config, to_local_datetime

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
    aspects = compute_normal_aspects(subject, active_points=cfg.active_points)
    major_aspects = compute_major_aspects(subject_dict, active_points=cfg.active_points)
    anchor_dt = to_local_datetime(payload.birth)
    point_sign_range = []
    if payload.asc_moon_sun_range_enabled:
        for point_key in ("ascendant", "moon", "sun"):
            point_sign_range.append(
                compute_point_sign_range(
                    payload.birth,
                    cfg,
                    anchor_dt,
                    point_key=point_key,
                    identifier="natal",
                    label=payload.birth.name or "Natal",
                )
            )
    return NatalResponse(
        subject=subject_dict,
        aspects=aspects,
        major_aspects=major_aspects,
        point_sign_range=point_sign_range,
    )
