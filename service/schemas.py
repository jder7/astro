from datetime import datetime
from typing import List, Optional, Literal

from pydantic import AliasChoices, BaseModel, Field, ConfigDict, model_validator

from service.enums import (
    HouseSystem,
    Mode,
    Perspective,
    RangeGranularity,
    RangeTarget,
    ReportKind,
    SiderealMode,
    Theme,
    ZodiacType,
)


class BirthData(BaseModel):
    """
    Basic birth / event data needed to create a full Kerykeion subject.

    Defaults are chosen so that OpenAPI / Swagger show a fully prefilled example
    (Amsterdam, NL), but you can override any field in requests.
    """

    name: str = Field(
        "Subject",
        description="Label used for the chart (e.g. person's name or event).",
        examples=["Jane Doe"],
    )
    year: int = Field(
        1990,
        description="Year in Gregorian calendar.",
        examples=[1990],
    )
    month: int = Field(
        1,
        ge=1,
        le=12,
        description="Month number, 1-12.",
        examples=[7],
    )
    day: int = Field(
        1,
        ge=1,
        le=31,
        description="Day of the month, 1-31.",
        examples=[15],
    )
    hour: int = Field(
        12,
        ge=0,
        le=23,
        description="Hour in 24h format (0-23).",
        examples=[10],
    )
    minute: int = Field(
        0,
        ge=0,
        le=59,
        description="Minute (0-59).",
        examples=[30],
    )
    lng: float = Field(
        4.8952,
        ge=-180.0,
        le=180.0,
        description="Longitude in decimal degrees (East positive, West negative). Default: Amsterdam, NL.",
        examples=[4.8952],
    )
    lat: float = Field(
        52.3702,
        ge=-90.0,
        le=90.0,
        description="Latitude in decimal degrees (North positive, South negative). Default: Amsterdam, NL.",
        examples=[52.3702],
    )
    tz_str: str = Field(
        "Europe/Amsterdam",
        description="IANA timezone string, e.g. 'Europe/Amsterdam'.",
        examples=["Europe/Amsterdam"],
    )
    city: Optional[str] = Field(
        "Amsterdam",
        description="Optional city label used only for display / metadata.",
        examples=["Amsterdam"],
    )
    nation: Optional[str] = Field(
        "NL",
        description="Optional ISO 3166-1 alpha-2 country code, e.g. 'NL'.",
        examples=["NL"],
    )


class ChartConfig(BaseModel):
    """
    High-level configuration wrapper around Kerykeion chart options.

    Defaults match your intended baseline:
    - Perspective: Topocentric
    - Zodiac: Sidereal
    - Sidereal mode: KRISHNAMURTI
    - House system: Whole Sign
    - Theme: classic
    """

    perspective: Perspective = Field(
        default=Perspective.TOPOCENTRIC,
        description="Chart perspective; forwarded as `perspective_type`.",
        examples=[Perspective.TOPOCENTRIC],
    )
    zodiac_type: ZodiacType = Field(
        default=ZodiacType.SIDEREAL,
        description="Zodiac reference frame ('Tropic' or 'Sidereal').",
        examples=[ZodiacType.SIDEREAL],
    )
    sidereal_mode: Optional[SiderealMode] = Field(
        default=SiderealMode.KRISHNAMURTI,
        description="Sidereal ayanamsa mode when zodiac_type is Sidereal.",
        examples=[SiderealMode.KRISHNAMURTI],
    )
    house_system: HouseSystem = Field(
        default=HouseSystem.WHOLE_SIGN,
        description="House system identifier code (A..Y). Default is whole sign ('W').",
        examples=[HouseSystem.WHOLE_SIGN],
    )
    theme: Theme = Field(
        default=Theme.CLASSIC,
        description="Visual theme used for SVG chart rendering.",
        examples=[Theme.CLASSIC],
    )
    active_points: list[str] = Field(
        default_factory=lambda: [
            "sun",
            "moon",
            "mercury",
            "venus",
            "mars",
            "jupiter",
            "saturn",
            "ascendant",
        ],
        description="Chart points to include (passed to Kerykeion).",
    )

class NextLunation(BaseModel):
    """
    Next lunation event info (Full/New) with timestamp.
    """

    model_config = ConfigDict(populate_by_name=True)

    type: Literal["Full Moon", "New Moon"] = Field(
        ...,
        description="Type of lunation event.",
    )
    timestamp: datetime = Field(
        ...,
        alias="timestamp",
        serialization_alias="timestamp",
        description="Timestamp (tz-aware) of the lunation, rounded to the minute.",
    )


class PointSignRangeEntry(BaseModel):
    """
    Generic point sign interval with explicit start/end timestamps (minute precision).
    """

    model_config = ConfigDict(populate_by_name=True)

    start: datetime = Field(
        ...,
        validation_alias=AliasChoices("start", "start_timestamp", "startTimestamp", "timestamp", "time", "date"),
        serialization_alias="start",
        description="Start of the sign interval (rounded to the minute).",
    )
    end: datetime = Field(
        ...,
        description="Timestamp (tz-aware) when the point leaves this sign (start of the next sign).",
    )
    sign: Optional[str] = Field(default=None, description="Three-letter sign code, e.g. 'Ari', 'Tau'.")
    sign_num: Optional[int] = Field(default=None, description="One-based sign index (Aries=1, Pisces=12).")
    element: Optional[str] = Field(default=None, description="Element for the point at this interval (Fire, Earth, Air, Water).")
    quality: Optional[str] = Field(default=None, description="Quality for the point at this interval (Cardinal, Fixed, Mutable).")
    emoji: Optional[str] = Field(default=None, description="Sign glyph when available.")
    phase: Optional[str] = Field(default=None, description="Lunar phase name when point_key is moon.")
    phase_emoji: Optional[str] = Field(default=None, description="Emoji representing the lunar phase.")
    illumination_percentage: Optional[float] = Field(
        default=None,
        description="Moon illumination percentage (0-100) when point_key is moon.",
    )


class PointSignRange(BaseModel):
    """
    Sign sweep for a specific chart point starting at the requested datetime.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(
        ...,
        description="Stable identifier for the range (e.g. 'natal-sun', 'transit-mars').",
    )
    label: Optional[str] = Field(
        default=None,
        description="Display label for this point range (e.g. 'Natal', 'Transit').",
    )
    anchor: datetime = Field(
        ...,
        description="Anchor datetime used as the start of the window.",
    )
    point_key: str = Field(
        ...,
        serialization_alias="pointKey",
        description="Point key for this range (e.g. 'mars', 'medium_coeli').",
    )
    point_label: Optional[str] = Field(
        default=None,
        serialization_alias="pointLabel",
        description="Display label for the point (e.g. 'Mars').",
    )
    entries: List[PointSignRangeEntry] = Field(
        default_factory=list,
        alias="entries",
        description="Sign entries across the window for the point.",
    )
    next_lunation: Optional["NextLunation"] = Field(
        default=None,
        alias="next_lunation",
        description="Next lunation (Full or New Moon) relative to the anchor when point_key is moon.",
    )


class AspectPointSummary(BaseModel):
    """
    Lightweight summary for a chart point used in aspect computation.
    """

    name: Optional[str] = Field(default=None, description="Display name of the point.")
    sign: Optional[str] = Field(default=None, description="Three-letter sign code.")
    position: Optional[float] = Field(default=None, description="Position within the sign (0-30 degrees).")
    abs_pos: Optional[float] = Field(default=None, description="Absolute ecliptic position (0-360 degrees).")
    house: Optional[str] = Field(default=None, description="House label when available.")
    retrograde: Optional[bool] = Field(default=None, description="Retrograde flag for the point.")


class AspectMeta(BaseModel):
    """
    Aspect metadata following the Ptolemaic major aspects.
    """

    name: str = Field(..., description="Aspect name (conjunction, sextile, square, trine, opposition).")
    angle: float = Field(..., description="Exact aspect angle in degrees.")
    orb: float = Field(..., description="Orb difference from the exact angle.")
    icon: Optional[str] = Field(default=None, description="Aspect glyph/icon.")


class MajorAspectEntry(BaseModel):
    """
    Single aspect hit between two active points.
    """

    base_key: str = Field(..., description="Normalized key for the base/left point (lowercase).")
    other_key: str = Field(..., description="Normalized key for the other/right point (lowercase).")
    aspect_type: str = Field(..., description="Aspect type label.")
    angle: float = Field(..., description="Exact aspect angle in degrees.")
    orb: float = Field(..., description="Orb difference from the exact angle (degrees).")
    angle_difference: float = Field(..., description="Normalized angular distance between the two points (0-180).")
    icon: Optional[str] = Field(default=None, description="Aspect glyph/icon.")
    aspect: AspectMeta = Field(..., description="Aspect metadata including glyph and orb.")
    base: AspectPointSummary = Field(..., description="Summary of the base/left chart point.")
    other: AspectPointSummary = Field(..., description="Summary of the other/right chart point.")


class PtolemaicAspectLink(BaseModel):
    """
    Link (edge) within a Ptolemaic pattern.
    """

    type: str = Field(..., description="Aspect type between the two points.")
    pair: list[str] = Field(..., description="Ordered pair of point keys involved in the link.")
    pair_owners: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("pair_owners", "pairOwners"),
        serialization_alias="pairOwners",
        description="Owner tags aligned with `pair` values (`1` or `2`) when available.",
    )
    orb: float = Field(..., description="Orb difference for this link.")
    difference: float = Field(..., description="Angular difference in degrees.")


class PtolemaicPatternAspect(BaseModel):
    """
    Serialized high-level Ptolemaic configuration (e.g., grand trine, grand cross).
    """

    id: str = Field(..., description="Pattern identifier, e.g., grand_trine.")
    name: str = Field(..., description="Pattern display name.")
    planets: str = Field(..., description="Human label of planet count, e.g., '3 planets'.")
    aspects: list[str] = Field(..., description="Aspect types involved in the pattern.")
    aspects_label: str = Field(..., description="Label summarizing the aspect mix.")
    geometry: str = Field(..., description="Short description of the geometric layout.")
    orb: str = Field(..., description="Typical orb allowances description.")
    construction: str = Field(..., description="How the pattern is constructed.")
    points: list[str] = Field(..., description="Ordered point keys participating in the pattern.")
    point_owners: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("point_owners", "pointOwners"),
        serialization_alias="pointOwners",
        description="Owner tags aligned with `points` (`1` or `2`) when available.",
    )
    links: list[PtolemaicAspectLink] = Field(..., description="Edges between points with aspect metadata.")
    structure: dict = Field(default_factory=dict, description="Optional structure hints (axes, triples, chains, etc.).")


class NormalAspectEntry(BaseModel):
    """
    Normal aspect entry as returned by Kerykeion, lightly normalized.
    """

    left: str = Field(..., description="Label for the first point.")
    aspect: str = Field(..., description="Aspect label/name.")
    right: str = Field(..., description="Label for the second point.")
    orb: Optional[str] = Field(default=None, description="Formatted orb label when available.")
    orb_value: Optional[float] = Field(default=None, description="Orb value in degrees when parsable.")
    movement: Optional[str] = Field(default=None, description="Applying/separating/fixed when present.")
    raw: dict = Field(default_factory=dict, description="Raw aspect payload from Kerykeion.")


class NatalRequest(BaseModel):
    """
    Request payload for a natal chart computation.
    """

    asc_moon_sun_range_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "ascMoonSunRangeEnabled",
            "asc_moon_sun_range_enabled",
            "ascendantRangeEnabled",
            "ascendant_range_enabled",
            "moonRangeEnabled",
            "moon_range_enabled",
        ),
        serialization_alias="ascMoonSunRangeEnabled",
        description="When true, include ascendant, Moon, and Sun sign sweeps around the provided datetime.",
    )
    birth: BirthData = Field(
        default_factory=BirthData,
        description="Birth data used to compute the natal chart. Pre-filled with example values.",
    )
    config: ChartConfig = Field(
        default_factory=ChartConfig,
        description=(
            "Chart configuration. Defaults to Topocentric, Sidereal, "
            "KRISHNAMURTI ayanamsa, Whole Sign houses, classic theme."
        ),
    )


class NatalResponse(BaseModel):
    """
    Structured natal chart response.
    """
    point_sign_range: List[PointSignRange] = Field(
        default_factory=list,
        serialization_alias="pointSignRange",
        description="Point sign sweep(s) around the requested birth datetime when enabled.",
    )
    subject: dict = Field(
        ...,
        description="Raw AstrologicalSubject model from Kerykeion serialized as JSON.",
    )
    aspects: List[NormalAspectEntry] = Field(
        ...,
        description="Standard aspects returned by Kerykeion.",
    )
    major_aspects: List[PtolemaicPatternAspect] = Field(
        ...,
        description="High-level Ptolemaic configurations computed from the subject.",
    )


class TransitMomentInput(BaseModel):
    """
    Date/time/location for a transit snapshot.

    Similar to BirthData but without a `name` field, since transit snapshots are
    often anonymous.
    """

    year: int = Field(
        2025,
        description="Year in Gregorian calendar.",
        examples=[2025],
    )
    month: int = Field(
        1,
        ge=1,
        le=12,
        description="Month number, 1-12.",
        examples=[1],
    )
    day: int = Field(
        1,
        ge=1,
        le=31,
        description="Day of the month, 1-31.",
        examples=[1],
    )
    hour: int = Field(
        12,
        ge=0,
        le=23,
        description="Hour in 24h format (0-23).",
        examples=[12],
    )
    minute: int = Field(
        0,
        ge=0,
        le=59,
        description="Minute (0-59).",
        examples=[0],
    )
    lng: float = Field(
        4.8952,
        description="Longitude in decimal degrees (East positive, West negative). Default: Amsterdam, NL.",
        examples=[4.8952],
    )
    lat: float = Field(
        52.3702,
        description="Latitude in decimal degrees (North positive, South negative). Default: Amsterdam, NL.",
        examples=[52.3702],
    )
    tz_str: str = Field(
        "Europe/Amsterdam",
        description="IANA timezone string, e.g. 'Europe/Amsterdam'.",
        examples=["Europe/Amsterdam"],
    )
    city: Optional[str] = Field(
        "Amsterdam",
        description="Optional city label used only for display / metadata.",
        examples=["Amsterdam"],
    )
    nation: Optional[str] = Field(
        "NL",
        description="Optional ISO 3166-1 alpha-2 country code, e.g. 'NL'.",
        examples=["NL"],
    )


class TransitEndInput(BaseModel):
    """
    End date/time for a transit range.

    Location and timezone are reused from the `moment` field in TransitRangeRequest.
    """

    year: int = Field(
        2025,
        description="End year in Gregorian calendar.",
        examples=[2025],
    )
    month: int = Field(
        1,
        ge=1,
        le=12,
        description="End month number, 1-12.",
        examples=[1],
    )
    day: int = Field(
        2,
        ge=1,
        le=31,
        description="End day of the month, 1-31.",
        examples=[2],
    )
    hour: int = Field(
        12,
        ge=0,
        le=23,
        description="End hour in 24h format (0-23).",
        examples=[12],
    )
    minute: int = Field(
        0,
        ge=0,
        le=59,
        description="End minute (0-59).",
        examples=[0],
    )


class TransitMomentRequest(BaseModel):
    """
    Transit snapshot for a single moment, optionally relative to a birth chart.
    """

    asc_moon_sun_range_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "ascMoonSunRangeEnabled",
            "asc_moon_sun_range_enabled",
            "ascendantRangeEnabled",
            "ascendant_range_enabled",
            "moonRangeEnabled",
            "moon_range_enabled",
        ),
        serialization_alias="ascMoonSunRangeEnabled",
        description="When true, include ascendant, Moon, and Sun sweeps for the requested moment (and natal when provided).",
    )
    moment: TransitMomentInput = Field(
        default_factory=TransitMomentInput,
        description="Moment/location used as the transit snapshot.",
    )
    birth: Optional[BirthData] = Field(
        default=None,
        description="Optional natal birth chart. When present, response includes `natal_subject`.",
    )
    config: ChartConfig = Field(
        default_factory=ChartConfig,
        description="Chart configuration; defaults are applied when omitted.",
    )


class HousePlanetsMap(BaseModel):
    """
    House-indexed projected planets.

    - Keys are house numbers 1..12.
    - Values are ordered planet keys.
    - All houses should be present; empty houses use [].
    """

    houses: dict[int, list[str]] = Field(
        default_factory=lambda: {idx: [] for idx in range(1, 13)},
        description="Projected planets per house number.",
    )


class TransitHouseProjections(BaseModel):
    """
    Transit planet projection map.
    """

    transit_into_natal: HousePlanetsMap = Field(
        default_factory=HousePlanetsMap,
        description="Transit planets projected into natal houses.",
    )


class RelationshipHouseProjections(BaseModel):
    """
    Bi-directional relationship house projection map.
    """

    first_into_second: HousePlanetsMap = Field(
        default_factory=HousePlanetsMap,
        description="First subject planets projected into second subject houses.",
    )
    second_into_first: HousePlanetsMap = Field(
        default_factory=HousePlanetsMap,
        description="Second subject planets projected into first subject houses.",
    )


class TransitSnapshot(BaseModel):
    """
    Single snapshot within a transit sequence.
    """
    point_sign_range: List[PointSignRange] = Field(
        default_factory=list,
        serialization_alias="pointSignRange",
        description="Point sign sweep(s) for this snapshot when enabled.",
    )
    timestamp: datetime = Field(
        ...,
        description="Local datetime (with timezone) corresponding to this transit snapshot.",
    )
    subject: dict = Field(
        ...,
        description="Transit subject (sky at this moment) as JSON.",
    )
    aspects: List[NormalAspectEntry] = Field(
        default_factory=list,
        description="Standard aspects returned by Kerykeion for the transit subject.",
    )
    major_aspects: List[PtolemaicPatternAspect] = Field(
        default_factory=list,
        description="High-level Ptolemaic configurations computed for the transit subject.",
    )
    natal_subject: Optional[dict] = Field(
        default=None,
        description="Optional natal subject JSON, when a birth chart was provided.",
    )
    natal_aspects: Optional[List[NormalAspectEntry]] = Field(
        default=None,
        description="Standard aspects returned by Kerykeion for the natal subject when provided.",
    )
    natal_major_aspects: Optional[List[PtolemaicPatternAspect]] = Field(
        default=None,
        description="High-level Ptolemaic configurations for the natal subject when provided.",
    )
    synastry: Optional[dict] = Field(
        default=None,
        description="Dual-chart synastry aspects between the transit and natal subjects when provided.",
    )
    synastry_major_aspects: List[PtolemaicPatternAspect] = Field(
        default_factory=list,
        serialization_alias="synastryMajorAspects",
        description="Cross-subject Ptolemaic configurations between transit and natal subjects when provided.",
    )
    house_projections: Optional[TransitHouseProjections] = Field(
        default=None,
        validation_alias=AliasChoices("house_projections", "houseProjections"),
        serialization_alias="houseProjections",
        description="Transit+natal house projection payload when natal chart is provided.",
    )


class TransitResponse(BaseModel):
    """
    Response for the /transit endpoint.
    """
    snapshot: TransitSnapshot


class RangeRequest(BaseModel):
    """
    On-demand range request for point sweeps.
    """

    mode: Mode = Field(
        default=Mode.NATAL,
        description="Which chart mode the ranges should be computed for.",
        examples=[Mode.NATAL, Mode.TRANSIT, Mode.NATAL_TRANSIT],
    )
    targets: List[RangeTarget] = Field(
        default_factory=lambda: [RangeTarget.ASCENDANT, RangeTarget.MOON, RangeTarget.SUN],
        description="Which ranges to compute (active points such as sun, moon, mars, ascendant).",
        examples=[[RangeTarget.ASCENDANT, RangeTarget.MOON]],
    )
    birth: Optional[BirthData] = Field(
        default=None,
        description="Birth data (required for natal, optional for transit).",
    )
    first: Optional[BirthData] = Field(
        default=None,
        description="First subject for relationship mode.",
    )
    second: Optional[BirthData] = Field(
        default=None,
        description="Second subject for relationship mode.",
    )
    moment: Optional[TransitMomentInput] = Field(
        default=None,
        description="Transit moment (required for transit/natal_transit).",
    )
    config: ChartConfig = Field(
        default_factory=ChartConfig,
        description="Chart configuration shared across the range computation.",
    )


class RangeResponse(BaseModel):
    """
    Response for on-demand range requests.
    """
    point_sign_range: List[PointSignRange] = Field(
        default_factory=list,
        serialization_alias="pointSignRange",
        description="Point sign ranges when requested.",
    )


class TransitRangeRequest(BaseModel):
    """
    Transit snapshots for a range of time.

    Uses a single transit-style input (`moment`) plus an end date/time. Location
    and timezone are taken from `moment` for the entire range.
    """

    asc_moon_sun_range_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "ascMoonSunRangeEnabled",
            "asc_moon_sun_range_enabled",
            "ascendantRangeEnabled",
            "ascendant_range_enabled",
            "moonRangeEnabled",
            "moon_range_enabled",
        ),
        serialization_alias="ascMoonSunRangeEnabled",
        description="When true, include ascendant, Moon, and Sun sweeps around the start moment (and natal when provided).",
    )
    moment: TransitMomentInput = Field(
        default_factory=TransitMomentInput,
        description="Start moment (date/time/location).",
    )
    end: TransitEndInput = Field(
        default_factory=TransitEndInput,
        description="End date/time; location and timezone reused from `moment`.",
    )
    granularity: RangeGranularity = Field(
        default=RangeGranularity.HOUR,
        description="Step size used to sample the range (minute, hour, day, month).",
        examples=[RangeGranularity.HOUR],
    )
    birth: Optional[BirthData] = Field(
        default=None,
        description="Optional natal birth chart. When present, each snapshot includes `natal_subject`.",
    )
    config: ChartConfig = Field(
        default_factory=ChartConfig,
        description="Chart configuration shared across all snapshots.",
    )
    include_aspects: bool = Field(
        default=False,
        validation_alias=AliasChoices("includeAspects", "include_aspects"),
        serialization_alias="includeAspects",
        description="When true, compute and include standard aspects and major aspect configurations for each snapshot (and natal when provided).",
    )


class TransitRangeSnapshot(BaseModel):
    """
    Simplified snapshot for the /transit-range endpoint (transit only).
    """

    timestamp: datetime = Field(
        ...,
        description="Local datetime (with timezone) corresponding to this transit snapshot.",
    )
    subject: dict = Field(
        ...,
        description="Transit subject (sky at this moment) as JSON.",
    )
    aspects: List[NormalAspectEntry] = Field(
        default_factory=list,
        description="Standard aspects returned by Kerykeion for the transit subject.",
    )
    major_aspects: List[PtolemaicPatternAspect] = Field(
        default_factory=list,
        description="High-level Ptolemaic configurations computed for the transit subject.",
    )


class TransitRangeResponse(BaseModel):
    """
    Response for the /transit-range endpoint (transit-only snapshots).
    """

    snapshots: List[TransitRangeSnapshot]


class WeeklyScheduleSegment(BaseModel):
    """
    Generic time-bounded segment used by the weekly ray schedule.
    """

    start: datetime = Field(..., description="Segment start (inclusive), timezone-aware.")
    end: datetime = Field(..., description="Segment end (exclusive), timezone-aware.")
    ratio: float = Field(..., ge=0.0, le=1.0, description="Segment share within the parent interval.")
    point_key: Optional[str] = Field(
        default=None,
        serialization_alias="pointKey",
        description="Astro point key for this segment (e.g. 'ascendant', 'moon').",
    )
    label: Optional[str] = Field(default=None, description="Display label for this segment.")
    sign: Optional[str] = Field(default=None, description="Sign label for this segment.")
    sign_icon: Optional[str] = Field(
        default=None,
        serialization_alias="signIcon",
        description="Sign icon/glyph.",
    )
    element: Optional[str] = Field(default=None, description="Element label when available.")
    color: Optional[str] = Field(default=None, description="Primary display color for this segment.")
    ray_colors: List[str] = Field(
        default_factory=list,
        serialization_alias="rayColors",
        description="Ordered ray color list for this segment sign.",
    )
    phase: Optional[str] = Field(default=None, description="Moon phase label when available.")
    illumination_percentage: Optional[float] = Field(
        default=None,
        serialization_alias="illuminationPercentage",
        description="Moon illumination percentage when available.",
    )


class WeeklyScheduleComponent(BaseModel):
    """
    Point component used in hourly tooltips and card labels.
    """

    point_key: str = Field(..., serialization_alias="pointKey")
    label: str = Field(..., description="Display label for the component point.")
    sign: Optional[str] = Field(default=None, description="Sign label.")
    sign_icon: Optional[str] = Field(default=None, serialization_alias="signIcon")
    element: Optional[str] = Field(default=None, description="Element label.")
    color: Optional[str] = Field(default=None, description="Primary component color.")
    ray_colors: List[str] = Field(default_factory=list, serialization_alias="rayColors")
    start: Optional[datetime] = Field(default=None, description="Optional segment start for this component.")
    end: Optional[datetime] = Field(default=None, description="Optional segment end for this component.")


class WeeklyScheduleCell(BaseModel):
    """
    One hourly cell in the weekly schedule matrix.
    """

    start: datetime = Field(..., description="Cell start datetime.")
    end: datetime = Field(..., description="Cell end datetime.")
    asc_segments: List[WeeklyScheduleSegment] = Field(
        default_factory=list,
        serialization_alias="ascSegments",
        description="Ascendant segments within this hour (supports split hours).",
    )
    day_ruler_segment: List[WeeklyScheduleSegment] = Field(
        default_factory=list,
        serialization_alias="dayRulerSegment",
        description="Day-ruler segment(s) active during this hour.",
    )
    sun_component: Optional[WeeklyScheduleComponent] = Field(
        default=None,
        serialization_alias="sunComponent",
        description="Sun component at this hour.",
    )
    moon_component: Optional[WeeklyScheduleComponent] = Field(
        default=None,
        serialization_alias="moonComponent",
        description="Moon component at this hour.",
    )
    has_element_sigil: bool = Field(
        default=False,
        serialization_alias="hasElementSigil",
        description="True when all 4 elements are present across Sun/Moon/Day-ruler/Asc within the hour.",
    )
    sigil: dict = Field(default_factory=dict, description="Sigil payload compatible with frontend ElementSigil.")
    tooltip: dict = Field(default_factory=dict, description="Tooltip payload with component details.")


class WeeklyScheduleRow(BaseModel):
    """
    One hourly row in the weekly schedule matrix.
    """

    hour: int = Field(..., ge=0, le=23, description="Hour index in local time.")
    label: str = Field(..., description="Display label for the row (HH:MM).")
    cells: List[WeeklyScheduleCell] = Field(default_factory=list, description="Seven day cells for this hour.")


class WeeklyScheduleDay(BaseModel):
    """
    One day column descriptor in the weekly schedule.
    """

    date: datetime = Field(..., description="Day start datetime (00:00 local).")
    weekday: str = Field(..., description="Weekday display label.")
    day_index: int = Field(..., serialization_alias="dayIndex", ge=0, le=6)
    ruler_key: str = Field(..., serialization_alias="rulerKey", description="Day ruler point key.")
    ruler_icon: str = Field(..., serialization_alias="rulerIcon", description="Day ruler icon.")
    ruler_segments: List[WeeklyScheduleSegment] = Field(
        default_factory=list,
        serialization_alias="rulerSegments",
        description="Day-ruler sign segments across 00:00 -> 24:00 local.",
    )
    aura_segments: List[WeeklyScheduleSegment] = Field(
        default_factory=list,
        serialization_alias="auraSegments",
        description="Aura segments aligned with ruler segments for column rendering.",
    )
    has_ruler_split: bool = Field(
        default=False,
        serialization_alias="hasRulerSplit",
        description="True when day ruler changes sign at least once during the day.",
    )
    moon_phase: Optional[str] = Field(
        default=None,
        serialization_alias="moonPhase",
        description="Moon phase sampled for this day (local-time midpoint).",
    )
    moon_illumination_percentage: Optional[float] = Field(
        default=None,
        serialization_alias="moonIlluminationPercentage",
        description="Moon illumination percentage sampled for this day (local-time midpoint).",
    )
    start: datetime = Field(..., description="Day start datetime.")
    end: datetime = Field(..., description="Day end datetime.")


class WeeklyScheduleWeekMeta(BaseModel):
    """
    Week metadata for the weekly ray schedule response.
    """

    start: datetime = Field(..., description="ISO week start (Monday 00:00 local).")
    end: datetime = Field(..., description="ISO week end boundary (next Monday 00:00 local).")
    tz: str = Field(..., description="IANA timezone used for schedule generation.")
    default_window_start: int = Field(
        default=6,
        serialization_alias="defaultWindowStart",
        ge=0,
        le=23,
        description="Default visible hour window start.",
    )
    default_window_end: int = Field(
        default=20,
        serialization_alias="defaultWindowEnd",
        ge=1,
        le=24,
        description="Default visible hour window end (exclusive).",
    )


class WeeklyRayScheduleRequest(BaseModel):
    """
    Request payload for the weekly ray schedule.
    """

    mode: Mode = Field(
        default=Mode.TRANSIT,
        description="Supported modes: transit and natal_transit.",
    )
    moment: TransitMomentInput = Field(
        default_factory=TransitMomentInput,
        description="Transit moment used as weekly anchor.",
    )
    birth: Optional[BirthData] = Field(
        default=None,
        description="Optional natal data for natal_transit mode; schedule remains transit-driven.",
    )
    config: ChartConfig = Field(
        default_factory=ChartConfig,
        description="Chart configuration shared by schedule calculations.",
    )


class WeeklyRaySchedulePdfRequest(WeeklyRayScheduleRequest):
    """
    Request payload for weekly schedule PDF export.
    """

    hour_start: int = Field(
        default=6,
        serialization_alias="hourStart",
        ge=0,
        le=23,
        description="Visible hour window start for PDF export.",
    )
    hour_end: int = Field(
        default=20,
        serialization_alias="hourEnd",
        ge=1,
        le=24,
        description="Visible hour window end (exclusive) for PDF export.",
    )

    @model_validator(mode="after")
    def _validate_window(self):
        if self.hour_end <= self.hour_start:
            raise ValueError("hour_end must be greater than hour_start.")
        return self


class WeeklyRayScheduleResponse(BaseModel):
    """
    Response payload for the weekly ray schedule.
    """

    week: WeeklyScheduleWeekMeta
    sun_header_segments: List[WeeklyScheduleSegment] = Field(
        default_factory=list,
        serialization_alias="sunHeaderSegments",
        description="Sun sign segments clipped to the week range.",
    )
    moon_header_segments: List[WeeklyScheduleSegment] = Field(
        default_factory=list,
        serialization_alias="moonHeaderSegments",
        description="Moon sign segments clipped to the week range.",
    )
    days: List[WeeklyScheduleDay] = Field(default_factory=list, description="Seven day descriptors.")
    rows: List[WeeklyScheduleRow] = Field(default_factory=list, description="24 hourly rows.")


class ReportRequest(BaseModel):
    """
    Request configuration for the report generator endpoint.
    """

    kind: ReportKind = Field(
        default=ReportKind.NATAL,
        description="Type of report to generate: SUBJECT or NATAL.",
        examples=[ReportKind.NATAL],
    )
    birth: BirthData = Field(
        default_factory=BirthData,
        description="Birth data used as base for the report.",
    )
    config: ChartConfig = Field(
        default_factory=ChartConfig,
        description="Chart configuration used when constructing the subject/chart.",
    )
    include_aspects: bool = Field(
        default=True,
        description="Whether to include aspects when generating SUBJECT reports.",
        examples=[True],
    )
    max_aspects: int = Field(
        default=50,
        ge=0,
        le=200,
        description="Maximum number of aspects when generating NATAL reports.",
        examples=[50],
    )
    first: Optional[BirthData] = Field(
        default=None,
        description="First partner (inner wheel) for relationship mode reports.",
    )
    second: Optional[BirthData] = Field(
        default=None,
        description="Second partner (outer wheel) for relationship mode reports.",
    )
    moment: Optional[TransitMomentInput] = Field(
        default=None,
        description="Transit-style moment used for transit or dual-wheel PDFs.",
    )
    mode: Optional[Mode] = Field(
        default=None,
        description="Optional report mode label used for naming/handling PDF downloads.",
        examples=[Mode.NATAL],
    )


class SvgPdfRequest(BaseModel):
    """
    Request body for generating chart PDFs from SVGs.
    """

    mode: Mode = Field(
        default=Mode.NATAL,
        description="Chart mode to render as PDF.",
        examples=[Mode.NATAL],
    )
    birth: Optional[BirthData] = Field(default=None, description="Birth data for natal / inner wheel.")
    moment: Optional[TransitMomentInput] = Field(default=None, description="Transit moment for transit / outer wheel.")
    first: Optional[BirthData] = Field(default=None, description="First partner for relationship charts.")
    second: Optional[BirthData] = Field(default=None, description="Second partner for relationship charts.")
    config: ChartConfig = Field(default_factory=ChartConfig, description="Chart configuration.")
    grid_view: bool = Field(default=False, description="Show synastry grid view when mode=relationship.")


class ReportResponse(BaseModel):
    """
    Rich report payload: Markdown text plus structured sections.
    """

    kind: ReportKind
    text: str = Field(
        ...,
        description="Report body formatted as Markdown (safe to render as text).",
    )
    structured: dict = Field(
        ...,
        description="Structured report data (subjects, houses, aspects) suitable for PDFs.",
    )


class RelationshipRequest(BaseModel):
    """
    Request payload for a relationship / aspects evaluation between two charts.
    """
    first: BirthData = Field(
        default_factory=BirthData,
        description="First subject birth data.",
    )
    second: BirthData = Field(
        default_factory=BirthData,
        description="Second subject birth data.",
    )
    config: ChartConfig = Field(
        default_factory=ChartConfig,
        description="Shared chart configuration for both subjects.",
    )


class RelationshipResponse(BaseModel):
    """
    Dual chart aspects between two subjects.
    """
    first_subject: dict = Field(
        ...,
        description="First AstrologicalSubject JSON dump.",
    )
    second_subject: dict = Field(
        ...,
        description="Second AstrologicalSubject JSON dump.",
    )
    aspects: List[NormalAspectEntry] = Field(
        default_factory=list,
        description="Standard aspects for the first subject.",
    )
    major_aspects: List[PtolemaicPatternAspect] = Field(
        default_factory=list,
        description="Ptolemaic configurations for the first subject.",
    )
    natal_aspects: List[NormalAspectEntry] = Field(
        default_factory=list,
        description="Standard aspects for the second subject.",
    )
    natal_major_aspects: List[PtolemaicPatternAspect] = Field(
        default_factory=list,
        description="Ptolemaic configurations for the second subject.",
    )
    synastry: dict = Field(
        ...,
        description="Raw DualChartAspectsModel from Kerykeion serialized to JSON.",
    )
    synastry_major_aspects: List[PtolemaicPatternAspect] = Field(
        default_factory=list,
        serialization_alias="synastryMajorAspects",
        description="Cross-subject Ptolemaic configurations between first and second subjects.",
    )
    house_projections: Optional[RelationshipHouseProjections] = Field(
        default=None,
        validation_alias=AliasChoices("house_projections", "houseProjections"),
        serialization_alias="houseProjections",
        description="Bi-directional house projections between first and second subjects.",
    )


class SynastrySvgRequest(BaseModel):
    """
    Synastry SVG request payload.
    """

    first: BirthData = Field(
        default_factory=BirthData,
        description="First subject birth data.",
    )
    second: BirthData = Field(
        default_factory=BirthData,
        description="Second subject birth data.",
    )
    config: ChartConfig = Field(
        default_factory=ChartConfig,
        description="Shared chart configuration for both subjects.",
    )
    grid_view: bool = Field(
        default=True,
        description=(
            "If true, enable the aspect table grid view "
            "(double_chart_aspect_grid_type='table')."
        ),
        examples=[True],
    )


class GeoStatusResponse(BaseModel):
    """
    Google geocoding API availability state.
    """

    active: bool = Field(
        ...,
        description="True when a non-dummy API key is configured.",
    )
    configured: bool = Field(
        ...,
        description="True when any API key value is configured.",
    )
    message: Optional[str] = Field(
        default=None,
        description="Optional human-friendly message when inactive.",
    )


class GeoSearchRequest(BaseModel):
    """
    Search query for location lookup.
    """

    query: str = Field(
        ...,
        min_length=2,
        max_length=160,
        description="Freeform location query (city, address, region).",
        examples=["Amsterdam", "Los Angeles, CA"],
    )


class GeoSearchResult(BaseModel):
    """
    Top-level location match returned from Google geocoding.
    """

    place_id: str = Field(
        ...,
        description="Google place_id for subsequent resolution.",
    )
    label: str = Field(
        ...,
        description="Formatted address label for display.",
    )
    city: Optional[str] = Field(
        default=None,
        description="Resolved city or locality name when available.",
    )
    country_code: Optional[str] = Field(
        default=None,
        description="ISO 3166-1 alpha-2 country code when available.",
    )
    lat: Optional[float] = Field(
        default=None,
        description="Latitude in decimal degrees (north positive).",
    )
    lng: Optional[float] = Field(
        default=None,
        description="Longitude in decimal degrees (east positive).",
    )
    tz_str: Optional[str] = Field(
        default=None,
        description="IANA timezone string when available.",
    )


class GeoSearchResponse(BaseModel):
    """
    Search response with up to 5 matching locations.
    """

    active: bool = Field(
        ...,
        description="True when the Google geocoding API is active for this request.",
    )
    results: List[GeoSearchResult] = Field(
        default_factory=list,
        description="Top matching locations (limited to 5).",
    )


class GeoResolveRequest(BaseModel):
    """
    Resolve a Google place_id into coordinates.
    """

    place_id: str = Field(
        ...,
        min_length=1,
        description="Google place_id to resolve.",
    )


class GeoResolveResponse(BaseModel):
    """
    Resolved location details for a place_id.
    """

    place_id: str = Field(
        ...,
        description="Google place_id resolved.",
    )
    label: str = Field(
        ...,
        description="Formatted address label.",
    )
    city: Optional[str] = Field(
        default=None,
        description="Resolved city or locality name when available.",
    )
    country_code: Optional[str] = Field(
        default=None,
        description="ISO 3166-1 alpha-2 country code when available.",
    )
    lat: Optional[float] = Field(
        default=None,
        description="Latitude in decimal degrees (north positive).",
    )
    lng: Optional[float] = Field(
        default=None,
        description="Longitude in decimal degrees (east positive).",
    )
    tz_str: Optional[str] = Field(
        default=None,
        description="IANA timezone string when available.",
    )
