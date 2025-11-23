from fastapi import APIRouter

from schemas import RelationshipRequest, RelationshipResponse
from utils import compute_dual_chart_aspects

router = APIRouter(tags=["relationship"])


@router.post("/relationship", response_model=RelationshipResponse)
async def relationship(payload: RelationshipRequest) -> RelationshipResponse:
    """
    Compute dual-chart aspects between two subjects.

    Returns both AstrologicalSubject JSON dumps plus the dual-chart aspects model.
    """
    first_subject, second_subject, aspects_model = compute_dual_chart_aspects(
        payload.first,
        payload.second,
        payload.config,
    )

    return RelationshipResponse(
        first_subject=first_subject.model_dump(mode="json"),
        second_subject=second_subject.model_dump(mode="json"),
        aspects=aspects_model.model_dump(mode="json"),
    )
