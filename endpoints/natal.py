from fastapi import APIRouter

from schemas import NatalRequest, NatalResponse
from utils import (
    build_subject,
    compute_major_aspects,
    compute_normal_aspects,
    ensure_config,
)

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
    return NatalResponse(subject=subject_dict, aspects=aspects, major_aspects=major_aspects)
