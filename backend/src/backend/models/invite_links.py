import datetime
from enum import Enum
from typing import TYPE_CHECKING


from sqlalchemy import CheckConstraint, Integer, String, ForeignKey, Boolean, Date
from sqlalchemy.orm import Mapped, relationship
from sqlalchemy.orm import mapped_column
from sqlalchemy import Enum as SQLEnum

from .base import Base

class InviteLink(Base):
    __tablename__ = "invite_links"
    token : Mapped[str] = mapped_column(String(64), primary_key=True)
    usages_remaining: Mapped[int] = mapped_column(CheckConstraint("usages_remaining >= 0"), nullable=False)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), nullable=False)
    created_date: Mapped[datetime.datetime] = mapped_column(default=lambda :datetime.datetime.now())
    creator_id: Mapped[int] = mapped_column("users.id", nullable=False)

