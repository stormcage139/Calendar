from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, PlainSerializer


def utcnow() -> datetime:
    """Current time as naive UTC, the format stored in the DB."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_naive_utc(value: datetime) -> datetime:
    """Aware datetimes are converted to UTC; naive ones are taken as UTC already."""
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def to_utc_iso(value: datetime) -> str:
    return to_naive_utc(value).isoformat() + "Z"


# Input: anything ISO-8601, stored as naive UTC.
UtcInput = Annotated[datetime, AfterValidator(to_naive_utc)]
# Output: naive UTC from the DB, sent with an explicit "Z" so browsers don't read it as local time.
UtcOutput = Annotated[datetime, PlainSerializer(to_utc_iso, return_type=str)]
