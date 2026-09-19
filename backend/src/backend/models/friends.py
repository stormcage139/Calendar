from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class Friends(Base):
    __tablename__ = "friends"

    __table_args__ = (
        CheckConstraint("user1_id < user2_id", name="ck_friends_order"),
    )

    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"))

    user1_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    user2_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
