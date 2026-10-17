from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_logger
from backend.exceptions import InvalidStateError, NotFoundError, PermissionDeniedError
from backend.models.event import Event, EventStatus
from backend.models.event_members import EventMember, EventMemberInviteStatus
from backend.models.result import EventResult
from backend.models.user import User
from backend.repositories.event import (
    create_event as create_event_crud,
    get_all_user_events as get_all_user_events_crud,
    get_event_by_id,
    set_event_status,
    update_event as update_event_crud,
)
from backend.repositories.event_member import (
    add_members,
    get_member,
    remove_member,
    set_member_status,
)
from backend.repositories.result import get_results_for_events
from backend.repositories.users import get_users_by_logins
from backend.schemas.event import (
    EventDetailSchema,
    EventInputSchema,
    EventMemberOutputSchema,
    EventOutputSchema,
    EventUpdateSchema,
)

log = get_logger(__name__)

CLOSED_STATUSES = (EventStatus.ENDED, EventStatus.CANCELLED)


def find_member(event: Event, user_id: int) -> EventMember | None:
    return next((member for member in event.members if member.user_id == user_id), None)


def is_joined(event: Event, user_id: int) -> bool:
    """Joined members propose options and vote. The creator always counts as joined."""
    if event.creator_id == user_id:
        return True
    member = find_member(event, user_id)
    return member is not None and member.invitestatus == EventMemberInviteStatus.JOINED


async def load_event_for_user(event_id: int, user: User, session: AsyncSession) -> Event:
    """The event if the user is its creator or a member (invited or joined), else NotFoundError."""
    event = await get_event_by_id(event_id, session=session)
    if event is None or (event.creator_id != user.id and find_member(event, user.id) is None):
        raise NotFoundError("event not found")
    return event


def ensure_creator(event: Event, user: User) -> None:
    if event.creator_id != user.id:
        raise PermissionDeniedError("only the event creator can do this")


def ensure_joined(event: Event, user: User) -> None:
    if not is_joined(event, user.id):
        raise PermissionDeniedError("accept the invitation first")


def ensure_open(event: Event) -> None:
    if event.status in CLOSED_STATUSES:
        raise InvalidStateError(f"event is {event.status.value}")


def to_output(event: Event, result: EventResult | None = None) -> EventOutputSchema:
    output = EventOutputSchema.model_validate(event)
    if result is not None:
        output.final_start = result.date_option.start
        output.final_end = result.date_option.end
    return output


def to_detail(
    event: Event,
    user: User,
    result: EventResult | None = None,
    awaiting_creator: bool = False,
) -> EventDetailSchema:
    members = [
        EventMemberOutputSchema(
            user_id=member.user_id,
            login=member.user.login,
            status=member.invitestatus.value,
        )
        for member in event.members
    ]
    # Events created before the creator was added as a member.
    if find_member(event, event.creator_id) is None:
        members.insert(
            0,
            EventMemberOutputSchema(
                user_id=event.creator_id, login=event.creator.login, status="joined"
            ),
        )
    if event.creator_id == user.id:
        my_status = "creator"
    else:
        my_status = find_member(event, user.id).invitestatus.value
    return EventDetailSchema(
        **to_output(event, result).model_dump(),
        creator_login=event.creator.login,
        members=members,
        my_status=my_status,
        awaiting_creator=awaiting_creator,
    )


async def list_user_events(user: User, session: AsyncSession) -> list[EventOutputSchema]:
    events = await get_all_user_events_crud(current_user_id=user.id, session=session)
    results = await get_results_for_events([event.id for event in events], session=session)
    return [to_output(event, results.get(event.id)) for event in events]


async def create_event(
    data: EventInputSchema, user: User, session: AsyncSession
) -> EventOutputSchema:
    event = await create_event_crud(event=data, current_user_id=user.id, session=session)
    return to_output(event)


async def update_event(
    event_id: int, data: EventUpdateSchema, user: User, session: AsyncSession
) -> Event:
    event = await load_event_for_user(event_id, user, session)
    ensure_creator(event, user)
    ensure_open(event)
    return await update_event_crud(event, data, session=session)


async def cancel_event(event_id: int, user: User, session: AsyncSession) -> Event:
    event = await load_event_for_user(event_id, user, session)
    ensure_creator(event, user)
    ensure_open(event)
    return await set_event_status(event, EventStatus.CANCELLED, session=session)


async def invite_users(
    event_id: int, logins: list[str], user: User, session: AsyncSession
) -> Event:
    event = await load_event_for_user(event_id, user, session)
    ensure_creator(event, user)
    ensure_open(event)
    users = await get_users_by_logins(logins, session=session)
    missing = set(logins) - {item.login for item in users}
    if missing:
        raise NotFoundError(f"unknown logins: {', '.join(sorted(missing))}")
    await add_members(
        event.id, [item.id for item in users if item.id != event.creator_id], session=session
    )
    return await load_event_for_user(event_id, user, session)


async def accept_invite(event_id: int, user: User, session: AsyncSession) -> Event:
    event = await load_event_for_user(event_id, user, session)
    ensure_open(event)
    member = await get_member(event.id, user.id, session=session)
    if member is None:
        raise InvalidStateError("you are the creator of this event")
    if member.invitestatus != EventMemberInviteStatus.JOINED:
        await set_member_status(member, EventMemberInviteStatus.JOINED, session=session)
    return await load_event_for_user(event_id, user, session)


async def decline_invite(event_id: int, user: User, session: AsyncSession) -> None:
    event = await load_event_for_user(event_id, user, session)
    if event.creator_id == user.id:
        raise InvalidStateError("the creator can't decline, cancel the event instead")
    member = await get_member(event.id, user.id, session=session)
    if member is None or member.invitestatus != EventMemberInviteStatus.INVITED:
        raise InvalidStateError("only a pending invitation can be declined")
    await remove_member(member, session=session)
