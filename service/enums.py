from enum import Enum


class Perspective(str, Enum):
    """Perspective of the chart – forwarded to Kerykeion as `perspective_type`."""
    APPARENT_GEOCENTRIC = "Apparent Geocentric"
    TRUE_GEOCENTRIC = "True Geocentric"
    HELIOCENTRIC = "Heliocentric"
    TOPOCENTRIC = "Topocentric"


class ZodiacType(str, Enum):
    """Zodiac reference frame."""
    TROPIC = "Tropic"
    SIDEREAL = "Sidereal"


class SiderealMode(str, Enum):
    """
    Sidereal ayanamsa mode.

    Kerykeion v5 currently documents LAHIRI and KRISHNAMURTI explicitly.
    """
    LAHIRI = "LAHIRI"
    KRISHNAMURTI = "KRISHNAMURTI"


class HouseSystem(str, Enum):
    """
    House system identifiers, mirroring Kerykeion / Swiss Ephemeris codes.

    Default for this API is WHOLE_SIGN ("W").
    """
    EQUAL = "A"
    ALCABITIUS = "B"
    CAMPANUS = "C"
    EQUAL_MC = "D"
    CARTER_POLI_EQU = "F"
    HORIZON_AZIMUTH = "H"
    SUNSHINE = "I"
    SUNSHINE_ALT = "i"
    KOCH = "K"
    PULLEN_SD = "L"
    MORINUS = "M"
    EQUAL_ARIES = "N"
    PORPHYRY = "O"
    PLACIDUS = "P"
    PULLEN_SR = "Q"
    REGIOMONTANUS = "R"
    SRIPATI = "S"
    POLICH_PAGE = "T"
    KRUSINSKI_PISA_GOELZER = "U"
    EQUAL_VEHL0W = "V"
    WHOLE_SIGN = "W"
    MERIDIAN = "X"
    APC = "Y"


class RangeGranularity(str, Enum):
    """Step size for transit range generation."""
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    MONTH = "month"


class RangeTarget(str, Enum):
    """Range segments to compute for point sweeps."""
    ASCENDANT = "ascendant"
    MOON = "moon"
    SUN = "sun"
    MERCURY = "mercury"
    VENUS = "venus"
    MARS = "mars"
    JUPITER = "jupiter"
    SATURN = "saturn"
    URANUS = "uranus"
    NEPTUNE = "neptune"
    PLUTO = "pluto"
    CHIRON = "chiron"
    MEAN_LILITH = "mean_lilith"
    TRUE_NORTH_LUNAR_NODE = "true_north_lunar_node"
    TRUE_SOUTH_LUNAR_NODE = "true_south_lunar_node"
    DESCENDANT = "descendant"
    MEDIUM_COELI = "medium_coeli"
    IMUM_COELI = "imum_coeli"


class ReportKind(str, Enum):
    """Which flavour of report to generate."""
    SUBJECT = "SUBJECT"
    NATAL = "NATAL"


class Theme(str, Enum):
    """
    Chart drawing theme.

    Names are passed directly to Kerykeion's ChartDrawer `theme` parameter.
    """
    CLASSIC = "classic"
    DARK = "dark"
    DARK_HIGH_CONTRAST = "dark-high-contrast"
    LIGHT = "light"
    STRAWBERRY = "strawberry"
    BLACK_AND_WHITE = "black-and-white"


class Mode(str, Enum):
    """Chart/report mode identifiers used across the API."""
    NATAL = "natal"
    TRANSIT = "transit"
    NATAL_TRANSIT = "natal_transit"
    RELATIONSHIP = "relationship"
