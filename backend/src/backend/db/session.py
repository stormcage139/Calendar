from typing import Annotated, AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)

from backend.core.config import config


class SessionDependency:
    def __init__(self):
        self.engine = create_async_engine(
            config.db.url,
            echo=config.db.echo,
        )
        self.async_session_maker = async_sessionmaker(
            bind=self.engine,
            expire_on_commit=False,
        )
        
session_dependency = SessionDependency()
