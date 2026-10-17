from collections.abc import Iterable

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_logger
from backend.core.timeutils import utcnow
from backend.exceptions import InvalidStateError, NotFoundError, PermissionDeniedError
from backend.models.date_option import DateOption
from backend.models.event import Event, EventStatus
from backend.models.event_members import EventMemberInviteStatus
from backend.models.result import EventResult, ResolvedBy
from backend.models.user import User
from backend.repositories.date_option import (
    add_option,
    delete_option as delete_option_crud,
    find_same_option,
    get_event_options,
    get_option,
)
from backend.repositories.event import set_event_status
from backend.repositories.result import get_result, save_result
from backend.repositories.vote import get_votes_for_event, replace_user_votes
from backend.schemas.event import (
    DateOptionInputSchema,
    DateOptionOutputSchema,
    ResultsSchema,
)
from backend.services.event import ensure_creator, ensure_joined, load_event_for_user

log = get_logger(__name__)


def tally(
    option_ids: list[int], voted_option_ids: Iterable[int]
) -> tuple[dict[int, int], list[int]]:
    """Approval count per option and the leaders (options with the most approvals).

    With no approvals at all every option is a leader, so the creator has to choose.
    Leaders keep the order of option_ids.
    """
    counts = {option_id: 0 for option_id in option_ids}
    for option_id in voted_option_ids:
        if option_id in counts:
            counts[option_id] += 1
    if not counts:
        return counts, []
    best = max(counts.values())
    leaders = [option_id for option_id, count in counts.items() if count == best]
    return counts, leaders


def option_to_output(option: DateOption, user_id: int) -> DateOptionOutputSchema:
    voters = sorted(vote.user.login for vote in option.votes)
    return DateOptionOutputSchema(
        id=option.id,
        start=option.start,
        end=option.end,
        author_id=option.author_id,
        author_login=option.author.login,
        votes=len(option.votes),
        voters=voters,
        voted_by_me=any(vote.user_id == user_id for vote in option.votes),
    )


async def _finalize(
    event: Event, option_id: int, resolved_by: ResolvedBy, session: AsyncSession
) -> EventResult:
    await save_result(event, option_id, resolved_by, session=session)
    # Re-read with the option loaded for the response.
    return await get_result(event.id, session=session)


async def auto_close_if_due(event: Event, session: AsyncSession) -> bool:
    """Close a vote whose deadline passed. Returns True when it's a tie the creator must resolve."""
    if event.status != EventStatus.IN_PROCESS or event.deadline > utcnow():
        return False
    options = await get_event_options(event.id, session=session)
    votes = await get_votes_for_event(event.id, session=session)
    _, leaders = tally([option.id for option in options], (v.date_option_id for v in votes))
    if len(leaders) == 1:
        log.info("event %s closed by deadline", event.id)
        await _finalize(event, leaders[0], ResolvedBy.DEADLINE, session)
        return False
    return True


async def list_options(
    event_id: int, user: User, session: AsyncSession
) -> list[DateOptionOutputSchema]:
    await load_event_for_user(event_id, user, session)
    options = await get_event_options(event_id, session=session)
    return [option_to_output(option, user.id) for option in options]


async def propose_option(
    event_id: int, data: DateOptionInputSchema, user: User, session: AsyncSession
) -> DateOptionOutputSchema:
    event = await load_event_for_user(event_id, user, session)
    ensure_joined(event, user)
    if event.status != EventStatus.CREATED:
        raise InvalidStateError("options can only be added before voting starts")
    if await find_same_option(event.id, data.start, data.end, session=session):
        raise InvalidStateError("this option was already proposed")
    option = await add_option(event.id, user.id, data.start, data.end, session=session)
    options = await get_event_options(event.id, session=session)
    return option_to_output(next(item for item in options if item.id == option.id), user.id)


async def delete_option(
    event_id: int, option_id: int, user: User, session: AsyncSession
) -> None:
    event = await load_event_for_user(event_id, user, session)
    option = await get_option(option_id, session=session)
    if option is None or option.event_id != event.id:
        raise NotFoundError("date option not found")
    if user.id not in (option.author_id, event.creator_id):
        raise PermissionDeniedError("only the author or the creator can remove an option")
    if event.status != EventStatus.CREATED:
        raise InvalidStateError("options can only be removed before voting starts")
    await delete_option_crud(option, session=session)


async def start_voting(event_id: int, user: User, session: AsyncSession) -> Event:
    event = await load_event_for_user(event_id, user, session)
    ensure_creator(event, user)
    if event.status != EventStatus.CREATED:
        raise InvalidStateError(f"event is {event.status.value}")
    if not await get_event_options(event.id, session=session):
        raise InvalidStateError("add at least one date option first")
    return await set_event_status(event, EventStatus.IN_PROCESS, session=session)


async def cast_votes(
    event_id: int, option_ids: list[int], user: User, session: AsyncSession
) -> list[DateOptionOutputSchema]:
    event = await load_event_for_user(event_id, user, session)
    ensure_joined(event, user)
    await auto_close_if_due(event, session)
    if event.status != EventStatus.IN_PROCESS:
        raise InvalidStateError("voting is not open")
    if event.deadline <= utcnow():
        raise InvalidStateError("the voting deadline has passed")
    options = await get_event_options(event.id, session=session)
    event_option_ids = {option.id for option in options}
    chosen = list(dict.fromkeys(option_ids))
    if not set(chosen) <= event_option_ids:
        raise NotFoundError("date option not found")
    await replace_user_votes(event.id, user.id, chosen, session=session)
    options = await get_event_options(event.id, session=session)
    return [option_to_output(option, user.id) for option in options]


async def close_voting(
    event_id: int, option_id: int | None, user: User, session: AsyncSession
) -> ResultsSchema:
    event = await load_event_for_user(event_id, user, session)
    ensure_creator(event, user)
    if event.status != EventStatus.IN_PROCESS:
        raise InvalidStateError("voting is not open")
    options = await get_event_options(event.id, session=session)
    votes = await get_votes_for_event(event.id, session=session)
    _, leaders = tally([option.id for option in options], (v.date_option_id for v in votes))
    if option_id is None:
        if len(leaders) != 1:
            raise InvalidStateError("tie: choose one of the leading options", leaders)
        await _finalize(event, leaders[0], ResolvedBy.VOTES, session)
    else:
        if option_id not in leaders:
            raise InvalidStateError("choose one of the leading options", leaders)
        resolved_by = ResolvedBy.VOTES if len(leaders) == 1 else ResolvedBy.CREATOR
        await _finalize(event, option_id, resolved_by, session)
    return await get_results(event_id, user, session)


async def get_results(event_id: int, user: User, session: AsyncSession) -> ResultsSchema:
    event = await load_event_for_user(event_id, user, session)
    await auto_close_if_due(event, session)
    options = await get_event_options(event.id, session=session)
    outputs = [option_to_output(option, user.id) for option in options]
    _, leaders = tally(
        [option.id for option in options],
        (vote.date_option_id for option in options for vote in option.votes),
    )
    result = await get_result(event.id, session=session)
    joined = [
        member for member in event.members
        if member.invitestatus == EventMemberInviteStatus.JOINED
    ]
    return ResultsSchema(
        status=event.status.value,
        options=outputs,
        leaders=leaders,
        is_tie=len(leaders) > 1,
        voters_count=len({vote.user_id for option in options for vote in option.votes}),
        members_count=max(len(joined), 1),
        final=next((o for o in outputs if result and o.id == result.date_option_id), None),
        resolved_by=result.resolved_by.value if result else None,
    )
