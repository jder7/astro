from datetime import datetime, timedelta
from typing import Generator
from zoneinfo import ZoneInfo
from calendar import monthrange

from service.enums import RangeGranularity
from service.schemas import BirthData


def to_local_datetime(birth: BirthData) -> datetime:
    """Convert BirthData to an aware datetime using tz_str."""
    tz = ZoneInfo(birth.tz_str)
    return datetime(
        birth.year,
        birth.month,
        birth.day,
        birth.hour,
        birth.minute,
        tzinfo=tz,
    )


def add_months(dt: datetime, months: int) -> datetime:
    """Add a number of months to a datetime, keeping timezone and clamping the day."""
    year = dt.year + (dt.month - 1 + months) // 12
    month = (dt.month - 1 + months) % 12 + 1
    last_day = monthrange(year, month)[1]
    day = min(dt.day, last_day)
    return dt.replace(year=year, month=month, day=day)


def iter_range_datetimes(
    start: datetime,
    end: datetime,
    granularity: RangeGranularity,
) -> Generator[datetime, None, None]:
    """Yield datetimes from start to end (inclusive) according to the desired granularity."""
    if start > end:
        raise ValueError("start must be <= end")

    current = start

    if granularity == RangeGranularity.MINUTE:
        delta = timedelta(minutes=1)
        while current <= end:
            yield current
            current += delta
    elif granularity == RangeGranularity.HOUR:
        delta = timedelta(hours=1)
        while current <= end:
            yield current
            current += delta
    elif granularity == RangeGranularity.DAY:
        delta = timedelta(days=1)
        while current <= end:
            yield current
            current += delta
    elif granularity == RangeGranularity.MONTH:
        while current <= end:
            yield current
            current = add_months(current, 1)
    else:
        raise ValueError(f"Unsupported granularity: {granularity}")
