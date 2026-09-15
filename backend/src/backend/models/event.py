from datetime import date
from enum import Enum


from sqlalchemy import Integer, String, ForeignKey, Boolean, Date
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy import Enum as SQLEnum


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
        server_default=False,
        default=False,
    )
    creator: Mapped[int] = mapped_column(ForeignKey("users.id"))
    deadline: Mapped[date] = mapped_column(Date()) 
    status: Mapped[EventStatus] = mapped_column(SQLEnum(EventStatus,name="event_status"),default=EventStatus.CREATED)
