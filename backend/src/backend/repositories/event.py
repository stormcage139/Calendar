from typing import Sequence

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.config import get_logger
from backend.exceptions import NotFoundError
from backend.models.event import Event, EventStatus
from backend.models.event_members import EventMember, EventMemberInviteStatus
from backend.repositories.users import get_users_by_logins
from backend.schemas.event import EventInputSchema, EventUpdateSchema

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
    # Resolve invited logins first, so an unknown login creates nothing.
    invited_users = await get_users_by_logins(event.invite_logins, session=session)
    missing = set(event.invite_logins) - {user.login for user in invited_users}
    if missing:
        raise NotFoundError(f"unknown logins: {', '.join(sorted(missing))}")

    new_event = Event(
        name=event.name,
        description=event.description,
        creator_id=current_user_id,
        deadline=event.deadline,
        online=event.online,
        status=EventStatus.CREATED,
    )
    # The creator takes part in the event and votes like everyone else.
    new_event.members.append(
        EventMember(user_id=current_user_id, invitestatus=EventMemberInviteStatus.JOINED)
    )
    for user in invited_users:
        if user.id != current_user_id:
            new_event.members.append(
                EventMember(user_id=user.id, invitestatus=EventMemberInviteStatus.INVITED)
            )
    session.add(new_event)
    try:
        await session.commit()
        return new_event
    except Exception as ex:
        log.error("cant commit new event %s", ex)
        await session.rollback()
        raise


async def get_event_by_id(event_id: int, session: AsyncSession) -> Event | None:
    """Event with members and their users loaded."""
    stmt = (
        select(Event)
        .where(Event.id == event_id)
        .options(
            selectinload(Event.members).selectinload(EventMember.user),
            selectinload(Event.creator),
        )
        .execution_options(populate_existing=True)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def update_event(
    event: Event, data: EventUpdateSchema, session: AsyncSession
) -> Event:
    for key, value in data.model_dump(exclude_unset=True).items():
        # "description": null clears it; other fields can't be nulled.
        if value is None and key != "description":
            continue
        setattr(event, key, value)
    try:
        await session.commit()
        return event
    except Exception as ex:
        log.error("cant update event %s", ex)
        await session.rollback()
        raise


async def set_event_status(
    event: Event, status: EventStatus, session: AsyncSession
) -> Event:
    event.status = status
    try:
        await session.commit()
        return event
    except Exception as ex:
        log.error("cant change event status %s", ex)
        await session.rollback()
        raise
