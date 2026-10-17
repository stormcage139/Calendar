from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import SessionDep
from backend.core.config import get_logger
from backend.models.event import Event
from backend.models.event_members import EventMember, EventMemberInviteStatus
from backend.models.friends import Friends
from backend.models.user import User

log = get_logger(__name__)


async def create_invite_to_event(current_user_id, session: AsyncSession) -> Event:
    pass


async def get_member(
    event_id: int, user_id: int, session: AsyncSession
) -> EventMember | None:
    stmt = select(EventMember).where(
        (EventMember.event_id == event_id) & (EventMember.user_id == user_id)
    )
    result = await session.execute(stmt)
    return result.scalars().first()


async def add_members(
    event_id: int, user_ids: list[int], session: AsyncSession
) -> list[EventMember]:
    """Invite users; users who are already members are skipped."""
    existing = await session.execute(
        select(EventMember.user_id).where(EventMember.event_id == event_id)
    )
    existing_ids = set(existing.scalars().all())
    new_members = [
        EventMember(
            event_id=event_id,
            user_id=user_id,
            invitestatus=EventMemberInviteStatus.INVITED,
        )
        for user_id in user_ids
        if user_id not in existing_ids
    ]
    session.add_all(new_members)
    try:
        await session.commit()
        return new_members
    except Exception as ex:
        log.error("cant add event members %s", ex)
        await session.rollback()
        raise


async def set_member_status(
    member: EventMember, status: EventMemberInviteStatus, session: AsyncSession
) -> EventMember:
    member.invitestatus = status
    try:
        await session.commit()
        return member
    except Exception as ex:
        log.error("cant change member status %s", ex)
        await session.rollback()
        raise


async def remove_member(member: EventMember, session: AsyncSession) -> None:
    try:
        await session.delete(member)
        await session.commit()
    except Exception as ex:
        log.error("cant remove event member %s", ex)
        await session.rollback()
        raise
