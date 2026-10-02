from datetime import date
from enum import Enum
from typing import TYPE_CHECKING


from sqlalchemy import Integer, String, ForeignKey, Boolean, Date
from sqlalchemy.orm import Mapped, relationship
from sqlalchemy.orm import mapped_column
from sqlalchemy import Enum as SQLEnum
from .base import Base


if TYPE_CHECKING:
    from .user import User


class EventMemberInviteStatus(Enum):
    INVITED = 'invited'
    JOINED = "joined"
    

class EventMember(Base):
    """ "событие, пользователь/гостевой токен, роль, статус приглашения, время ответа"""

    __tablename__ = "event_members"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # role: Mapped[int] = mapped_column(ForeignKey(role.id)) # TODO: сделать модель роли
    invitestatus: Mapped[EventMemberInviteStatus] = mapped_column(
        SQLEnum(EventMemberInviteStatus, name="event_invite_status"),
        default=EventMemberInviteStatus.INVITED,
    )
    user: Mapped[list["User"]] = relationship(back_populates="event_member")
