from fastapi import APIRouter

from schemas import NatalRequest, NatalResponse
from utils import build_subject, ensure_config

router = APIRouter(tags=["natal"])


@router.post("/natal", response_model=NatalResponse)
async def natal_chart(payload: NatalRequest) -> NatalResponse:
    """
    Compute a natal chart configuration as a structured JSON response.
    """
    cfg = ensure_config(payload.config)
    subject = build_subject(payload.birth, cfg)
    subject_dict = subject.model_dump(mode="json")
    return NatalResponse(subject=subject_dict)
