from fastapi import APIRouter, Response, Request

from schemas import ReportRequest, ReportResponse
from utils import generate_report_content, render_structured_report_pdf

router = APIRouter(tags=["report"])


@router.post("/report", response_model=ReportResponse)
async def generate_report(payload: ReportRequest, request: Request) -> ReportResponse:
    """
    Generate a rich report (structured data + Markdown text).
    """
    try:
        raw = await request.json()
    except Exception:
        raw = "<unavailable>"
    print(
        "Report request received",
        {
            "mode": payload.mode,
            "kind": str(payload.kind),
            "has_first": bool(getattr(payload, "first", None)),
            "has_second": bool(getattr(payload, "second", None)),
            "payload": payload.dict(exclude_none=True),
            "raw_body": raw,
        },
    )
    structured, text = generate_report_content(payload)
    return ReportResponse(kind=payload.kind, text=text, structured=structured)


@router.post("/report/pdf", response_class=Response)
async def generate_report_pdf(payload: ReportRequest, request: Request) -> Response:
    """
    Generate a PDF version of the structured report (no chart).
    """
    mode = payload.mode or "natal"
    try:
        raw = await request.json()
    except Exception:
        raw = "<unavailable>"
    print(
        "Report PDF request received",
        {
            "mode": mode,
            "kind": str(payload.kind),
            "has_first": bool(getattr(payload, "first", None)),
            "has_second": bool(getattr(payload, "second", None)),
            "payload": payload.dict(exclude_none=True),
            "raw_body": raw,
        },
    )
    structured, _ = generate_report_content(payload)
    mode = structured.get("mode", mode)
    pdf_bytes = render_structured_report_pdf(structured, filename_prefix=mode)
    headers = {"Content-Disposition": f'attachment; filename="{mode}-report.pdf"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
