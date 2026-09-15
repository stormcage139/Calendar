from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column


from .base import Base


class User(Base):
    
    __tablename__ = "Users"
    id: Mapped[int] = mapped_column(primary_key=True,autoincrement=True)
    login: Mapped[str] = mapped_column(String(length=64))
    email: Mapped[str] = mapped_column(String(length=128))
    password: Mapped[str] = mapped_column(String(length=128))
    
