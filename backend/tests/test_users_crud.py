import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.user import User
from backend.repositories.users import create_user, delete_user, update_user
from backend.schemas.users import UserInputSchema


@pytest.mark.asyncio
async def test_user_crud(db_session: AsyncSession) -> None:
    user_data = UserInputSchema(
        login="alice",
        email="alice@example.com",
        password="initial-password",
    )

    created_user = await create_user(user_data, db_session)
    assert created_user.id is not None
    assert created_user.login == "alice"

    updated_data = UserInputSchema(
        login="alice-updated",
        email="alice.updated@example.com",
        password="updated-password",
    )
    updated_user = await update_user(created_user.id, updated_data, db_session)
    assert updated_user.login == "alice-updated"
    assert updated_user.email == "alice.updated@example.com"
    assert updated_user.password == "updated-password"

    stored_user = await db_session.scalar(
        select(User).where(User.id == created_user.id)
    )
    assert stored_user is not None
    assert stored_user.login == "alice-updated"

    assert await delete_user(created_user.id, db_session) is True
    assert await db_session.get(User, created_user.id) is None
