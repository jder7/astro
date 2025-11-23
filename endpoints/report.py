from fastapi import APIRouter

from schemas import ReportRequest, ReportResponse
from utils import generate_report_text

router = APIRouter(tags=["report"])


@router.post("/report", response_model=ReportResponse)
async def generate_report(payload: ReportRequest) -> ReportResponse:
    """
    Generate a plain-text report via Kerykeion's ReportGenerator.

    The report text is returned as a string (no interpretations added by this API).
    """
    text = generate_report_text(payload)
    return ReportResponse(kind=payload.kind, text=text)
