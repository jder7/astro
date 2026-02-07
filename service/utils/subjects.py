from __future__ import annotations

from typing import Optional

from kerykeion import AstrologicalSubjectFactory  # type: ignore
from kerykeion.schemas.kerykeion_exception import KerykeionException  # type: ignore

from service.enums import HouseSystem, ZodiacType
from service.schemas import BirthData, ChartConfig
from .config import ensure_config
from .formatting import format_degree, house_display, sign_display


def build_subject(birth: BirthData, config: Optional[ChartConfig]):
    """
    Create a Kerykeion AstrologicalSubject from BirthData + ChartConfig.
    """
    cfg = ensure_config(config)
    # Flag to avoid infinite retry if fallback also fails.
    attempted_fallback = False

    kwargs = dict(
        name=birth.name,
        year=birth.year,
        month=birth.month,
        day=birth.day,
        hour=birth.hour,
        minute=birth.minute,
        lng=birth.lng,
        lat=birth.lat,
        tz_str=birth.tz_str,
        online=False,
    )

    # Chart configuration
    kwargs["zodiac_type"] = cfg.zodiac_type.value
    if cfg.zodiac_type == ZodiacType.SIDEREAL and cfg.sidereal_mode is not None:
        kwargs["sidereal_mode"] = cfg.sidereal_mode.value
    kwargs["perspective_type"] = cfg.perspective.value
    kwargs["houses_system_identifier"] = cfg.house_system.value

    # Keep a copy of the original inputs for debugging in case Kerykeion raises.
    original_kwargs = dict(kwargs)

    try:
        subject = AstrologicalSubjectFactory.from_birth_data(**kwargs)
    except KerykeionException as err:
        if "Ambiguous time error" in str(err):
            for is_dst in (True, False):
                try:
                    subject = AstrologicalSubjectFactory.from_birth_data(**{**kwargs, "is_dst": is_dst})
                    break
                except KerykeionException:
                    subject = None
            if subject is None:
                raise
        else:
            raise
    except ValueError as err:
        # Kerykeion can raise when a planet sits exactly on a house cusp; retry with Whole Sign as a safe fallback.
        if (
            not attempted_fallback
            and "Error in house calculation" in str(err)
            and cfg.house_system != HouseSystem.WHOLE_SIGN
        ):
            attempted_fallback = True
            safe_cfg = cfg.model_copy(deep=True)
            safe_cfg.house_system = HouseSystem.WHOLE_SIGN
            kwargs["houses_system_identifier"] = safe_cfg.house_system.value
            subject = AstrologicalSubjectFactory.from_birth_data(**kwargs)
            # debug_input = {
            #     "birth": birth.model_dump(),
            #     "config": cfg.model_dump(),
            #     "kwargs": original_kwargs,
            # }
            print(
                "[build_subject] house calculation failed; fell back to Whole Sign houses.",
                err,
                # "input:",
                # debug_input,
            )
        else:
            raise

    # Optionally override city/nation labels if provided explicitly in the request
    if birth.city:
        setattr(subject, "city", birth.city)
    if birth.nation:
        setattr(subject, "nation", birth.nation)

    return subject


def build_subject_for_moment(
    base: BirthData,
    dt,
    config: Optional[ChartConfig],
):
    """
    Reuse base location / timezone, but override date & time with the given datetime.
    """
    return build_subject(
        BirthData(
            name=base.name,
            year=dt.year,
            month=dt.month,
            day=dt.day,
            hour=dt.hour,
            minute=dt.minute,
            lng=base.lng,
            lat=base.lat,
            tz_str=base.tz_str,
            city=base.city,
            nation=base.nation,
        ),
        config,
    )


def extract_points_table(subject_data: dict) -> list[dict]:
    """
    Build a clean list of planetary/angle positions from a subject dump.
    """
    rows: list[dict] = []
    for code in subject_data.get("active_points", []) or []:
        key = code.lower()
        point = subject_data.get(key)
        if not isinstance(point, dict):
            continue
        rows.append(
            {
                "name": point.get("name", code).replace("_", " "),
                "sign": sign_display(point.get("sign")),
                "degree": format_degree(point.get("position")),
                "house": house_display(point.get("house")),
                "retrograde": bool(point.get("retrograde")),
            }
        )
    return rows


def extract_houses_table(subject_data: dict) -> list[dict]:
    """
    Build a table of house cusps from a subject dump.
    """
    rows: list[dict] = []
    for name in subject_data.get("houses_names_list", []) or []:
        key = name.lower()
        house = subject_data.get(key)
        if not isinstance(house, dict):
            continue
        rows.append(
            {
                "name": house_display(house.get("name", name)),
                "sign": sign_display(house.get("sign")),
                "degree": format_degree(house.get("position")),
            }
        )
    return rows


def build_subject_block(
    birth: BirthData,
    cfg: ChartConfig,
    label: str,
) -> tuple[dict, object]:
    """
    Build a structured block for a single subject, returning both the block and the raw subject.
    """
    subject = build_subject(birth, cfg)
    subject_data = subject.model_dump(mode="json")

    meta = {
        "name": subject_data.get("name") or birth.name,
        "local_datetime": subject_data.get("iso_formatted_local_datetime"),
        "utc_datetime": subject_data.get("iso_formatted_utc_datetime"),
        "location": ", ".join([v for v in [birth.city, birth.nation] if v]),
        "tz": birth.tz_str,
        "zodiac_type": subject_data.get("zodiac_type"),
        "sidereal_mode": subject_data.get("sidereal_mode"),
        "house_system": subject_data.get("houses_system_name") or subject_data.get("houses_system_identifier"),
        "perspective": subject_data.get("perspective_type"),
    }

    block = {
        "label": label,
        "meta": meta,
        "lunar_phase": subject_data.get("lunar_phase"),
        "points": extract_points_table(subject_data),
        "houses": extract_houses_table(subject_data),
        "raw_subject": subject_data,
    }
    return block, subject
