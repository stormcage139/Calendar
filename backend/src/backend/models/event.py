from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .event_members import EventMember

from .base import Base


class EventStatus(Enum):
    CREATED = "new"
    IN_PROCESS = "closed"
    ENDED = "active"


class Event(Base):
    """ "название, описание, тип, создатель, дедлайн, статус, настройки голосования"""

    __tablename__ = "events"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(length=128))
    online: Mapped[bool] = mapped_column(
        Boolean(),
        server_default="0",
        default=False,
    )
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    deadline: Mapped[datetime] = mapped_column(Date())
    status: Mapped[EventStatus] = mapped_column(
        SQLEnum(EventStatus, name="event_status"),
        default=EventStatus.CREATED,
    )
    members: Mapped[list["EventMember"]] = relationship(back_populates="event")

