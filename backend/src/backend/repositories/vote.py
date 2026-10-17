from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_logger
from backend.models.date_option import DateOption
from backend.models.vote import Vote

log = get_logger(__name__)


async def get_votes_for_event(event_id: int, session: AsyncSession) -> list[Vote]:
    stmt = (
        select(Vote)
        .join(DateOption, Vote.date_option_id == DateOption.id)
        .where(DateOption.event_id == event_id)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def replace_user_votes(
    event_id: int, user_id: int, option_ids: list[int], session: AsyncSession
) -> list[Vote]:
    """Approval voting: the given options become the user's whole vote in this event."""
    event_option_ids = select(DateOption.id).where(DateOption.event_id == event_id)
    try:
        await session.execute(
            delete(Vote).where(
                (Vote.user_id == user_id) & (Vote.date_option_id.in_(event_option_ids))
            )
        )
        votes = [Vote(date_option_id=option_id, user_id=user_id) for option_id in option_ids]
        session.add_all(votes)
        await session.commit()
        return votes
    except Exception as ex:
        log.error("cant save votes %s", ex)
        await session.rollback()
        raise
