from fastapi import APIRouter

router = APIRouter(tags=["system"])


@router.get("/health")
async def health_check() -> dict:
    """
    Simple liveness probe for the Astro API.
    """
    return {"status": "ok"}
