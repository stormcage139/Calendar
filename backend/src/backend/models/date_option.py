from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .user import User
    from .vote import Vote


class DateOption(Base):
    """A proposed date and time slot for an event. Times are naive UTC."""

    __tablename__ = "date_options"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    start: Mapped[datetime] = mapped_column(DateTime(), nullable=False)
    end: Mapped[datetime] = mapped_column(DateTime(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(), default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    author: Mapped["User"] = relationship()
    votes: Mapped[list["Vote"]] = relationship(
        back_populates="date_option", cascade="all, delete-orphan"
    )
