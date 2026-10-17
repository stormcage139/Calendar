import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.routers.friends import (
    get_all_friend_requests,
    get_all_friends,
    send_friend_request_by_login,
)
from tests.helpers import make_users


@pytest.mark.asyncio
async def test_friend_request_by_login_and_accept(db_session: AsyncSession) -> None:
    alice, bob = await make_users(db_session, "alice", "bob")

    assert await send_friend_request_by_login("bob", alice, db_session) is True

    # Both sides see the pending request with the other user's login.
    alice_requests = await get_all_friend_requests(db_session, alice)
    assert [(r.login, r.type.value) for r in alice_requests] == [("bob", "outgoing")]
    bob_requests = await get_all_friend_requests(db_session, bob)
    assert [(r.login, r.new_freind_id, r.type.value) for r in bob_requests] == [
        ("alice", alice.id, "incoming")
    ]

    # Sending back by login ("@" prefix allowed) accepts the request.
    assert await send_friend_request_by_login("@alice", bob, db_session) is True
    assert [u.login for u in await get_all_friends(alice, db_session)] == ["bob"]
    assert await get_all_friend_requests(db_session, alice) == []


@pytest.mark.asyncio
async def test_friend_request_by_login_errors(db_session: AsyncSession) -> None:
    (alice,) = await make_users(db_session, "alice")

    with pytest.raises(HTTPException) as unknown:
        await send_friend_request_by_login("nobody", alice, db_session)
    assert unknown.value.status_code == 404

    with pytest.raises(HTTPException) as self_request:
        await send_friend_request_by_login("alice", alice, db_session)
    assert self_request.value.status_code == 400
