from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column


from .base import Base


class Event(Base):
    __tablename__ = "Events"
    id: Mapped[int] = mapped_column(primary_key=True,autoincrement=True)