from typing import Optional

from service.enums import Mode, ZodiacType
from service.schemas import ChartConfig, ReportRequest


def ensure_config(config: Optional[ChartConfig]) -> ChartConfig:
    """
    Ensure we always operate with a full ChartConfig instance, applying
    API-level defaults when the caller passed None.
    """
    if config is None:
        config = ChartConfig()
    # If zodiac is tropical, sidereal mode should not affect calculations.
    if config.zodiac_type == ZodiacType.TROPIC:
        config.sidereal_mode = None

    # Normalize active points to Kerykeion-friendly casing.
    normalized_points = []
    for pt in getattr(config, "active_points", []) or []:
        if not pt:
            continue
        # convert snake_case to Title_Case with underscores
        norm = str(pt).replace("-", "_").replace(" ", "_").lower().split("_")
        norm = [s.capitalize() for s in norm if s]
        val = "_".join(norm)
        normalized_points.append(val or pt)
    if normalized_points:
        config.active_points = normalized_points
    return config


def resolve_mode(request: ReportRequest) -> Mode:
    """
    Infer the working mode for a report request.
    """
    mode = request.mode
    if mode is None:
        if request.first and request.second:
            mode = Mode.RELATIONSHIP
        elif request.birth and request.moment:
            mode = Mode.NATAL_TRANSIT
        elif request.moment:
            mode = Mode.TRANSIT
        else:
            mode = Mode.NATAL
    return mode
