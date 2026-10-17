from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.config import get_logger
from backend.models.event import Event, EventStatus
from backend.models.result import EventResult, ResolvedBy

log = get_logger(__name__)


async def get_result(event_id: int, session: AsyncSession) -> EventResult | None:
    stmt = (
        select(EventResult)
        .where(EventResult.event_id == event_id)
        .options(selectinload(EventResult.date_option))
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_results_for_events(
    event_ids: list[int], session: AsyncSession
) -> dict[int, EventResult]:
    if not event_ids:
        return {}
    stmt = (
        select(EventResult)
        .where(EventResult.event_id.in_(event_ids))
        .options(selectinload(EventResult.date_option))
    )
    result = await session.execute(stmt)
    return {item.event_id: item for item in result.scalars().all()}


async def save_result(
    event: Event, date_option_id: int, resolved_by: ResolvedBy, session: AsyncSession
) -> EventResult:
    """Store the final option and complete the event in one commit."""
    event_result = EventResult(
        event_id=event.id, date_option_id=date_option_id, resolved_by=resolved_by
    )
    session.add(event_result)
    event.status = EventStatus.ENDED
    try:
        await session.commit()
        return event_result
    except Exception as ex:
        log.error("cant save event result %s", ex)
        await session.rollback()
        raise
