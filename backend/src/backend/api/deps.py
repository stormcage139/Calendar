from typing import Annotated, AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from backend.db.session import session_dependency


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with session_dependency.async_session_maker() as session:
        yield session


# Annotion for db dependency
SessionDep = Annotated[AsyncSession, Depends(get_async_session)]
