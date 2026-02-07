from typing import Optional


def sign_display(sign: Optional[str]) -> str:
    """Return a readable zodiac sign label from a short code."""
    if not sign:
        return "-"
    mapping = {
        "Ari": "Aries",
        "Tau": "Taurus",
        "Gem": "Gemini",
        "Can": "Cancer",
        "Leo": "Leo",
        "Vir": "Virgo",
        "Lib": "Libra",
        "Sco": "Scorpio",
        "Sag": "Sagittarius",
        "Cap": "Capricorn",
        "Aqu": "Aquarius",
        "Pis": "Pisces",
    }
    return mapping.get(sign, sign)


def format_degree(position: Optional[float]) -> str:
    """
    Format a position in degrees and minutes using ASCII-safe markers.
    """
    if position is None:
        return "-"
    degrees = int(position)
    minutes = int(round((position - degrees) * 60))
    if minutes == 60:
        degrees += 1
        minutes = 0
    return f"{degrees}d {minutes:02d}m"


def house_display(name: Optional[str]) -> str:
    """
    Convert a house identifier like 'Eleventh_House' into a friendly label.
    """
    if not name:
        return "-"
    base = name.replace("_House", "").replace("_", " ")
    ordinal_map = {
        "First": "1st",
        "Second": "2nd",
        "Third": "3rd",
        "Fourth": "4th",
        "Fifth": "5th",
        "Sixth": "6th",
        "Seventh": "7th",
        "Eighth": "8th",
        "Ninth": "9th",
        "Tenth": "10th",
        "Eleventh": "11th",
        "Twelfth": "12th",
    }
    parts = base.split()
    if parts:
        first = parts[0]
        ordinal = ordinal_map.get(first, first)
        rest = " ".join(parts[1:]) if len(parts) > 1 else "House"
        if not rest:
            rest = "House"
        return f"{ordinal} {rest}".strip()
    return base
