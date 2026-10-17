import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.exceptions import InvalidStateError, NotFoundError, PermissionDeniedError
from backend.schemas.event import EventInputSchema, EventUpdateSchema
from backend.services import event as event_service
from tests.helpers import in_days, make_users


def event_input(**overrides) -> EventInputSchema:
    data = {"name": "Поездка", "deadline": in_days(3)} | overrides
    return EventInputSchema(**data)


@pytest.mark.asyncio
async def test_create_event_adds_creator_and_invites(db_session: AsyncSession) -> None:
    alice, bob, carol = await make_users(db_session, "alice", "bob", "carol")

    created = await event_service.create_event(
        event_input(description=" на выходные ", invite_logins=["@bob", "carol", "alice"]),
        alice,
        db_session,
    )
    assert created.status == "collecting"
    assert created.description == "на выходные"
    assert created.creator_id == alice.id

    event = await event_service.load_event_for_user(created.id, alice, db_session)
    detail = event_service.to_detail(event, alice)
    assert detail.my_status == "creator"
    assert {(m.login, m.status) for m in detail.members} == {
        ("alice", "joined"), ("bob", "invited"), ("carol", "invited"),
    }

    # Invited users see the event in their list too.
    assert [e.id for e in await event_service.list_user_events(bob, db_session)] == [created.id]


@pytest.mark.asyncio
async def test_create_event_with_unknown_login_creates_nothing(db_session: AsyncSession) -> None:
    (alice,) = await make_users(db_session, "alice")
    with pytest.raises(NotFoundError):
        await event_service.create_event(event_input(invite_logins=["ghost"]), alice, db_session)
    assert await event_service.list_user_events(alice, db_session) == []


def test_event_input_validation() -> None:
    with pytest.raises(ValidationError):
        event_input(name="   ")
    with pytest.raises(ValidationError):
        event_input(deadline=in_days(-1))
    with pytest.raises(ValidationError):
        event_input(name="x" * 129)
    # Time zones are converted to naive UTC.
    parsed = EventInputSchema(name="x", deadline="2099-01-01T12:00:00+03:00")
    assert parsed.deadline.isoformat() == "2099-01-01T09:00:00"


@pytest.mark.asyncio
async def test_only_creator_edits_and_cancels(db_session: AsyncSession) -> None:
    alice, bob, eve = await make_users(db_session, "alice", "bob", "eve")
    created = await event_service.create_event(
        event_input(invite_logins=["bob"]), alice, db_session
    )

    with pytest.raises(PermissionDeniedError):
        await event_service.update_event(created.id, EventUpdateSchema(name="x"), bob, db_session)
    # Outsiders don't even learn that the event exists.
    with pytest.raises(NotFoundError):
        await event_service.load_event_for_user(created.id, eve, db_session)

    updated = await event_service.update_event(
        created.id, EventUpdateSchema(name="Новое имя", online=True), alice, db_session
    )
    assert (updated.name, updated.online) == ("Новое имя", True)

    with pytest.raises(PermissionDeniedError):
        await event_service.cancel_event(created.id, bob, db_session)
    cancelled = await event_service.cancel_event(created.id, alice, db_session)
    assert cancelled.status.value == "cancelled"
    with pytest.raises(InvalidStateError):
        await event_service.update_event(created.id, EventUpdateSchema(name="y"), alice, db_session)


@pytest.mark.asyncio
async def test_invite_accept_decline(db_session: AsyncSession) -> None:
    alice, bob, carol = await make_users(db_session, "alice", "bob", "carol")
    created = await event_service.create_event(event_input(), alice, db_session)

    with pytest.raises(NotFoundError):
        await event_service.load_event_for_user(created.id, bob, db_session)
    with pytest.raises(NotFoundError):
        await event_service.invite_users(created.id, ["ghost"], alice, db_session)

    await event_service.invite_users(created.id, ["bob", "carol"], alice, db_session)
    # Inviting again is harmless.
    await event_service.invite_users(created.id, ["bob"], alice, db_session)
    with pytest.raises(PermissionDeniedError):
        await event_service.invite_users(created.id, ["carol"], bob, db_session)

    event = await event_service.accept_invite(created.id, bob, db_session)
    assert event_service.to_detail(event, bob).my_status == "joined"

    await event_service.decline_invite(created.id, carol, db_session)
    with pytest.raises(NotFoundError):
        await event_service.load_event_for_user(created.id, carol, db_session)

    # A joined member can't "decline", nor can the creator.
    with pytest.raises(InvalidStateError):
        await event_service.decline_invite(created.id, bob, db_session)
    with pytest.raises(InvalidStateError):
        await event_service.decline_invite(created.id, alice, db_session)

    event = await event_service.load_event_for_user(created.id, alice, db_session)
    assert {(m.login, m.status) for m in event_service.to_detail(event, alice).members} == {
        ("alice", "joined"), ("bob", "joined"),
    }
