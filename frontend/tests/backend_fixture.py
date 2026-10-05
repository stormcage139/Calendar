"""Run the unmodified backend against an isolated in-memory database."""
import sys
from contextlib import asynccontextmanager

import uvicorn
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.api.deps import get_async_session
from backend.main import app
from backend.models import Base

engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
sessions = async_sessionmaker(engine, expire_on_commit=False)


async def test_session():
    async with sessions() as session:
        yield session


@asynccontextmanager
async def lifespan(_app):
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app.dependency_overrides[get_async_session] = test_session
app.router.lifespan_context = lifespan
uvicorn.run(app, host="127.0.0.1", port=int(sys.argv[1]), log_level="error")
