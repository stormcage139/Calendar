from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.timeutils import utcnow
from backend.models.user import User


async def make_users(session: AsyncSession, *logins: str) -> list[User]:
    # Plain password: these tests never log in.
    users = [User(login=login, email=f"{login}@example.com", password="x") for login in logins]
    session.add_all(users)
    await session.commit()
    return users


def in_days(days: float):
    return utcnow() + timedelta(days=days)
