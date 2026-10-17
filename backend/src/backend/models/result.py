from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .date_option import DateOption


class ResolvedBy(Enum):
    VOTES = "votes"  # creator closed the vote, single leader
    CREATOR = "creator"  # tie, creator picked one of the leaders
    DEADLINE = "deadline"  # deadline passed, single leader


class EventResult(Base):
    """The final date option of an event."""

    __tablename__ = "event_results"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    date_option_id: Mapped[int] = mapped_column(
        ForeignKey("date_options.id"), nullable=False
    )
    resolved_by: Mapped[ResolvedBy] = mapped_column(
        SQLEnum(ResolvedBy, name="result_resolved_by"), nullable=False
    )
    resolved_at: Mapped[datetime] = mapped_column(
        DateTime(), default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    date_option: Mapped["DateOption"] = relationship()
