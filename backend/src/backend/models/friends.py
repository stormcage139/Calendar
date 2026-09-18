from sqlalchemy import Column, ForeignKey, Table
from .base import Base

friend_to_friend = Table(
    "friend_to_friend",
    Base.metadata,
    Column(
        "user2_id",
        ForeignKey("users.id"),
        primary_key=True,
    ),
    Column(
        "user1_id",
        ForeignKey("users.id"),
        primary_key=True,
    ),
)