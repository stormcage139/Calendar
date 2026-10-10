from typing import Sequence

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_logger
from backend.models.event import Event
from backend.models.event_members import EventMember
from backend.schemas.event import EventInputSchema

log = get_logger(__name__)


async def get_all_user_events(
    current_user_id, session: AsyncSession
) -> Sequence[Event]:
    stmt = (
        (select(Event))
        .where(
            or_(
                Event.creator_id == current_user_id,
                Event.members.any(
                    EventMember.user_id == current_user_id
                )
            )
        )
    )
    try:
        events_where_user_is_member = await session.execute(stmt)
        return events_where_user_is_member.scalars().all()
    except Exception as ex:
        log.error(ex)
        raise


async def get_all_managing_events(
    current_user_id, session: AsyncSession
) -> list[Event]:
    pass


async def create_event(
    event: EventInputSchema,
    current_user_id: int,
    session: AsyncSession,
) -> Event:
    new_event = Event(
        name=event.name,
        creator_id=current_user_id,
        deadline=event.deadline,
        online=event.online,
    )
    session.add(new_event)
    try:
        await session.commit()
        return new_event
    except Exception as ex:
        log.error("cant commit new event %s", ex)
        raise
