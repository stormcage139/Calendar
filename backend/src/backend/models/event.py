from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .event_members import EventMember

from .base import Base

if TYPE_CHECKING:
    from .user import User


class EventStatus(Enum):
    # The DB stores member names, so the names stay and only the values are fixed.
    CREATED = "collecting"  # members propose date options
    IN_PROCESS = "voting"  # options are fixed, members vote
    ENDED = "completed"  # final date is chosen
    CANCELLED = "cancelled"


class Event(Base):
    """ "название, описание, тип, создатель, дедлайн, статус, настройки голосования"""

    __tablename__ = "events"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(length=128))
    description: Mapped[str | None] = mapped_column(String(length=1024), default=None)
    online: Mapped[bool] = mapped_column(
        Boolean(),
        server_default="0",
        default=False,
    )
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # Voting deadline, naive UTC.
    deadline: Mapped[datetime] = mapped_column(DateTime())
    status: Mapped[EventStatus] = mapped_column(
        SQLEnum(EventStatus, name="event_status"),
        default=EventStatus.CREATED,
    )
    members: Mapped[list["EventMember"]] = relationship(back_populates="event")
    creator: Mapped["User"] = relationship()

