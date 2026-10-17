from datetime import timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.exceptions import InvalidStateError, NotFoundError, PermissionDeniedError
from backend.schemas.event import DateOptionInputSchema, EventInputSchema
from backend.services import event as event_service
from backend.services import voting
from tests.helpers import in_days, make_users


def slot(day: float, hours: int = 2) -> DateOptionInputSchema:
    start = in_days(day).replace(microsecond=0)
    return DateOptionInputSchema(start=start, end=start + timedelta(hours=hours))


async def setup_event(session: AsyncSession):
    """alice creates an event; bob joins, carol stays invited."""
    alice, bob, carol = await make_users(session, "alice", "bob", "carol")
    created = await event_service.create_event(
        EventInputSchema(name="Встреча", deadline=in_days(2), invite_logins=["bob", "carol"]),
        alice,
        session,
    )
    await event_service.accept_invite(created.id, bob, session)
    return created.id, alice, bob, carol


def test_tally() -> None:
    assert voting.tally([1, 2, 3], [2, 2, 3]) == ({1: 0, 2: 2, 3: 1}, [2])
    assert voting.tally([1, 2, 3], [1, 2])[1] == [1, 2]
    # No votes at all: everything is tied, the creator decides.
    assert voting.tally([1, 2], []) == ({1: 0, 2: 0}, [1, 2])
    # Votes for unknown options are ignored.
    assert voting.tally([1], [9]) == ({1: 0}, [1])
    assert voting.tally([], []) == ({}, [])


@pytest.mark.asyncio
async def test_full_vote_flow(db_session: AsyncSession) -> None:
    event_id, alice, bob, carol = await setup_event(db_session)

    first = await voting.propose_option(event_id, slot(5), alice, db_session)
    second = await voting.propose_option(event_id, slot(6), bob, db_session)
    assert (first.author_login, second.author_login) == ("alice", "bob")

    # Only joined members propose; no duplicates.
    with pytest.raises(PermissionDeniedError):
        await voting.propose_option(event_id, slot(7), carol, db_session)
    with pytest.raises(InvalidStateError):
        await voting.propose_option(event_id, slot(5), bob, db_session)
    # Votes wait for the voting phase, which only the creator starts.
    with pytest.raises(InvalidStateError):
        await voting.cast_votes(event_id, [first.id], bob, db_session)
    with pytest.raises(PermissionDeniedError):
        await voting.start_voting(event_id, bob, db_session)

    await voting.start_voting(event_id, alice, db_session)
    with pytest.raises(InvalidStateError):
        await voting.propose_option(event_id, slot(8), alice, db_session)

    await voting.cast_votes(event_id, [first.id, second.id], alice, db_session)
    options = await voting.cast_votes(event_id, [second.id], bob, db_session)
    assert [(o.votes, o.voted_by_me) for o in options] == [(1, False), (2, True)]
    with pytest.raises(PermissionDeniedError):
        await voting.cast_votes(event_id, [first.id], carol, db_session)
    with pytest.raises(NotFoundError):
        await voting.cast_votes(event_id, [999], bob, db_session)

    # Re-voting replaces the previous approval set.
    await voting.cast_votes(event_id, [second.id], alice, db_session)
    results = await voting.get_results(event_id, bob, db_session)
    assert results.leaders == [second.id]
    assert results.is_tie is False
    assert (results.voters_count, results.members_count) == (2, 2)
    assert results.options[1].voters == ["alice", "bob"]

    with pytest.raises(PermissionDeniedError):
        await voting.close_voting(event_id, None, bob, db_session)
    closed = await voting.close_voting(event_id, None, alice, db_session)
    assert closed.status == "completed"
    assert closed.final.id == second.id
    assert closed.resolved_by == "votes"

    listed = await event_service.list_user_events(bob, db_session)
    assert listed[0].final_start == second.start
    with pytest.raises(InvalidStateError):
        await voting.cast_votes(event_id, [first.id], bob, db_session)


@pytest.mark.asyncio
async def test_tie_needs_creator_choice(db_session: AsyncSession) -> None:
    event_id, alice, bob, _ = await setup_event(db_session)
    first = await voting.propose_option(event_id, slot(5), alice, db_session)
    second = await voting.propose_option(event_id, slot(6), alice, db_session)
    third = await voting.propose_option(event_id, slot(7), alice, db_session)
    await voting.start_voting(event_id, alice, db_session)
    await voting.cast_votes(event_id, [first.id], alice, db_session)
    await voting.cast_votes(event_id, [second.id], bob, db_session)

    with pytest.raises(InvalidStateError) as tie:
        await voting.close_voting(event_id, None, alice, db_session)
    assert tie.value.leaders == [first.id, second.id]
    # The choice must be one of the leaders.
    with pytest.raises(InvalidStateError):
        await voting.close_voting(event_id, third.id, alice, db_session)

    closed = await voting.close_voting(event_id, second.id, alice, db_session)
    assert (closed.final.id, closed.resolved_by) == (second.id, "creator")


@pytest.mark.asyncio
async def test_option_rules(db_session: AsyncSession) -> None:
    event_id, alice, bob, _ = await setup_event(db_session)
    with pytest.raises(InvalidStateError):
        await voting.start_voting(event_id, alice, db_session)  # no options yet

    mine = await voting.propose_option(event_id, slot(5), bob, db_session)
    alices = await voting.propose_option(event_id, slot(6), alice, db_session)
    with pytest.raises(PermissionDeniedError):
        await voting.delete_option(event_id, alices.id, bob, db_session)
    await voting.delete_option(event_id, mine.id, bob, db_session)
    assert [o.id for o in await voting.list_options(event_id, alice, db_session)] == [alices.id]


@pytest.mark.asyncio
async def test_deadline_auto_close(db_session: AsyncSession) -> None:
    event_id, alice, bob, _ = await setup_event(db_session)
    first = await voting.propose_option(event_id, slot(5), alice, db_session)
    second = await voting.propose_option(event_id, slot(6), alice, db_session)
    await voting.start_voting(event_id, alice, db_session)
    await voting.cast_votes(event_id, [first.id], alice, db_session)

    event = await event_service.load_event_for_user(event_id, alice, db_session)
    event.deadline = in_days(-1)
    await db_session.commit()

    # Late votes are rejected; reading the event closes it with the single leader.
    with pytest.raises(InvalidStateError):
        await voting.cast_votes(event_id, [second.id], bob, db_session)
    results = await voting.get_results(event_id, bob, db_session)
    assert (results.status, results.final.id, results.resolved_by) == (
        "completed", first.id, "deadline",
    )


@pytest.mark.asyncio
async def test_deadline_tie_waits_for_creator(db_session: AsyncSession) -> None:
    event_id, alice, _, _ = await setup_event(db_session)
    first = await voting.propose_option(event_id, slot(5), alice, db_session)
    await voting.propose_option(event_id, slot(6), alice, db_session)
    await voting.start_voting(event_id, alice, db_session)

    event = await event_service.load_event_for_user(event_id, alice, db_session)
    event.deadline = in_days(-1)
    await db_session.commit()

    assert await voting.auto_close_if_due(event, db_session) is True
    results = await voting.get_results(event_id, alice, db_session)
    assert (results.status, results.is_tie) == ("voting", True)
    closed = await voting.close_voting(event_id, first.id, alice, db_session)
    assert closed.resolved_by == "creator"
