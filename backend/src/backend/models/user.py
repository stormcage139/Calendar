from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column

if TYPE_CHECKING:
    from backend.models import EventMember


from .base import Base


class User(Base):

    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    login: Mapped[str] = mapped_column(String(length=64))
    email: Mapped[str] = mapped_column(String(length=128))
    password: Mapped[str] = mapped_column(String(length=128))

    event_member: Mapped["EventMember"] = relationship(back_populates="user")
    def __str__(self):
        return f"id:{self.id} / login: {self.login} / email: {self.email}"
    def __repr__(self):
        return str(self)
