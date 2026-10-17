from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.config import get_logger
from backend.models.date_option import DateOption
from backend.models.vote import Vote

log = get_logger(__name__)


async def get_event_options(event_id: int, session: AsyncSession) -> list[DateOption]:
    """Options of an event, ordered by start, with authors and votes (and voters) loaded."""
    stmt = (
        select(DateOption)
        .where(DateOption.event_id == event_id)
        .options(
            selectinload(DateOption.author),
            selectinload(DateOption.votes).selectinload(Vote.user),
        )
        .order_by(DateOption.start, DateOption.id)
        .execution_options(populate_existing=True)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_option(option_id: int, session: AsyncSession) -> DateOption | None:
    return await session.get(DateOption, option_id)


async def find_same_option(
    event_id: int, start: datetime, end: datetime, session: AsyncSession
) -> DateOption | None:
    stmt = select(DateOption).where(
        (DateOption.event_id == event_id)
        & (DateOption.start == start)
        & (DateOption.end == end)
    )
    result = await session.execute(stmt)
    return result.scalars().first()


async def add_option(
    event_id: int,
    author_id: int,
    start: datetime,
    end: datetime,
    session: AsyncSession,
) -> DateOption:
    option = DateOption(event_id=event_id, author_id=author_id, start=start, end=end)
    session.add(option)
    try:
        await session.commit()
        return option
    except Exception as ex:
        log.error("cant add date option %s", ex)
        await session.rollback()
        raise


async def delete_option(option: DateOption, session: AsyncSession) -> None:
    try:
        await session.delete(option)
        await session.commit()
    except Exception as ex:
        log.error("cant delete date option %s", ex)
        await session.rollback()
        raise
