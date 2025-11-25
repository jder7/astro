from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from enums import (
    Perspective,
    ZodiacType,
    SiderealMode,
    HouseSystem,
    RangeGranularity,
    ReportKind,
    Theme,
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


class NatalRequest(BaseModel):
    """
    Request payload for a natal chart computation.
    """

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

    subject: dict = Field(
        ...,
        description="Raw AstrologicalSubject model from Kerykeion serialized as JSON.",
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


class TransitSnapshot(BaseModel):
    """
    Single snapshot within a transit sequence.
    """

    timestamp: datetime = Field(
        ...,
        description="Local datetime (with timezone) corresponding to this transit snapshot.",
    )
    subject: dict = Field(
        ...,
        description="Transit subject (sky at this moment) as JSON.",
    )
    natal_subject: Optional[dict] = Field(
        default=None,
        description="Optional natal subject JSON, when a birth chart was provided.",
    )


class TransitResponse(BaseModel):
    """
    Response for the /transit endpoint.
    """

    snapshot: TransitSnapshot


class TransitRangeRequest(BaseModel):
    """
    Transit snapshots for a range of time.

    Uses a single transit-style input (`moment`) plus an end date/time. Location
    and timezone are taken from `moment` for the entire range.
    """

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


class TransitRangeResponse(BaseModel):
    """
    Response for the /transit-range endpoint.
    """

    snapshots: List[TransitSnapshot]


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
    moment: Optional[TransitMomentInput] = Field(
        default=None,
        description="Transit-style moment used for transit or dual-wheel PDFs.",
    )


class ReportResponse(BaseModel):
    """
    Plain-text report generated by Kerykeion's ReportGenerator.
    """

    kind: ReportKind
    text: str = Field(
        ...,
        description="ASCII table text as produced by Kerykeion's ReportGenerator.print_report().",
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
    aspects: dict = Field(
        ...,
        description="Raw DualChartAspectsModel from Kerykeion serialized to JSON.",
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
