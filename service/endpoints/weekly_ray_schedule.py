from fastapi import APIRouter, HTTPException, Response, status

from service.enums import Mode
from service.schemas import (
    WeeklyRaySchedulePdfRequest,
    WeeklyRayScheduleRequest,
    WeeklyRayScheduleResponse,
)
from service.utils.weekly_ray_schedule import build_weekly_ray_schedule, render_weekly_schedule_pdf

router = APIRouter(tags=["weekly-ray-schedule"])


@router.post("/weekly-ray-schedule", response_model=WeeklyRayScheduleResponse)
async def weekly_ray_schedule(payload: WeeklyRayScheduleRequest) -> WeeklyRayScheduleResponse:
    """
    Build a transit-driven weekly ray schedule with day-ruler split aura metadata.
    """
    print("POST /weekly-ray-schedule", payload.model_dump(exclude_none=True))
    if payload.mode not in {Mode.TRANSIT, Mode.NATAL_TRANSIT}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="weekly-ray-schedule supports only transit and natal_transit modes.",
        )
    try:
        return build_weekly_ray_schedule(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.post("/weekly-ray-schedule/pdf", response_class=Response)
async def weekly_ray_schedule_pdf(payload: WeeklyRaySchedulePdfRequest) -> Response:
    """
    Build a one-page A4 landscape PDF of the weekly ray schedule.
    """
    print("POST /weekly-ray-schedule/pdf", payload.model_dump(exclude_none=True))
    if payload.mode not in {Mode.TRANSIT, Mode.NATAL_TRANSIT}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="weekly-ray-schedule/pdf supports only transit and natal_transit modes.",
        )
    try:
        schedule = build_weekly_ray_schedule(payload)
        pdf_bytes = render_weekly_schedule_pdf(
            schedule,
            hour_start=payload.hour_start,
            hour_end=payload.hour_end,
            filename_prefix=f"weekly-ray-schedule-{payload.mode}",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    headers = {"Content-Disposition": f'attachment; filename="weekly-ray-schedule-{payload.mode}.pdf"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
