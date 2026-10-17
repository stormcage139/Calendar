from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .date_option import DateOption
    from .user import User


class Vote(Base):
    """Approval vote: a row means the user is fine with this date option."""

    __tablename__ = "votes"
    __table_args__ = (
        UniqueConstraint("date_option_id", "user_id", name="uq_votes_option_user"),
    )
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    date_option_id: Mapped[int] = mapped_column(
        ForeignKey("date_options.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(), default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    date_option: Mapped["DateOption"] = relationship(back_populates="votes")
    user: Mapped["User"] = relationship()
