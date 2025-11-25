from fastapi import APIRouter, Response

from schemas import ReportRequest, ReportResponse, BirthData, TransitMomentInput
from utils import (
    generate_report_text,
    ensure_config,
    build_subject,
    render_report_text_pdf,
)

router = APIRouter(tags=["report"])


@router.post("/report", response_model=ReportResponse)
async def generate_report(payload: ReportRequest) -> ReportResponse:
    """
    Generate a plain-text report via Kerykeion's ReportGenerator.

    The report text is returned as a string (no interpretations added by this API).
    """
    text = generate_report_text(payload)
    return ReportResponse(kind=payload.kind, text=text)


@router.post("/report/pdf", response_class=Response)
async def generate_report_pdf(payload: ReportRequest) -> Response:
    """
    Generate a PDF of the textual report only (no chart).
    """
    mode = payload.mode or "natal"
    report_text = generate_report_text(payload)
    pdf_bytes = render_report_text_pdf(report_text, filename_prefix=mode)
    headers = {"Content-Disposition": f'attachment; filename="{mode}-report.pdf"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
