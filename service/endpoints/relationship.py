from fastapi import APIRouter

from service.schemas import RelationshipRequest, RelationshipResponse
from service.utils import (
    HouseProjectionEngine,
    compute_dual_chart_aspects,
    compute_major_aspects,
    compute_normal_aspects,
    compute_synastry_major_aspects,
    ensure_config,
    filter_aspects_model,
)

router = APIRouter(tags=["relationship"])
projection_engine = HouseProjectionEngine()


@router.post("/relationship", response_model=RelationshipResponse)
async def relationship(payload: RelationshipRequest) -> RelationshipResponse:
    """
    Compute dual-chart aspects between two subjects.

    Returns both AstrologicalSubject JSON dumps plus the dual-chart aspects model.
    """
    print("POST /relationship", payload.model_dump(exclude_none=True))
    cfg = ensure_config(payload.config)
    first_subject, second_subject, aspects_model = compute_dual_chart_aspects(
        payload.first,
        payload.second,
        cfg,
    )

    aspects_model = filter_aspects_model(aspects_model, cfg.active_points)
    aspects_dump = aspects_model.model_dump(mode="json")
    first_dict = first_subject.model_dump(mode="json")
    second_dict = second_subject.model_dump(mode="json")
    first_aspects = compute_normal_aspects(first_subject, active_points=cfg.active_points)
    second_aspects = compute_normal_aspects(second_subject, active_points=cfg.active_points)
    first_major = compute_major_aspects(first_dict, active_points=cfg.active_points)
    second_major = compute_major_aspects(second_dict, active_points=cfg.active_points)
    synastry_major_aspects = compute_synastry_major_aspects(first_dict, second_dict, cfg.active_points)
    house_projections = projection_engine.build_relationship_response(first_dict, second_dict, cfg.active_points)
    return RelationshipResponse(
        first_subject=first_dict,
        second_subject=second_dict,
        aspects=first_aspects,
        major_aspects=first_major,
        natal_aspects=second_aspects,
        natal_major_aspects=second_major,
        synastry=aspects_dump,
        synastry_major_aspects=synastry_major_aspects,
        house_projections=house_projections,
    )
