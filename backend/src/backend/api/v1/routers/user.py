from typing import Dict

from fastapi import APIRouter

from backend.api.deps import SessionDep
from backend.models.user import User
from backend.services.users import UserInputSchema
from backend.repositories.users import (
    create_user as create_user_crud,
    update_user as update_user_crud,
)

# from backend.repositories import
router = APIRouter()


@router.get("/users/{id}")
async def get_all_users(id: int, session: SessionDep):
    return {"user": str(await session.get(User, id))}


@router.post("/users")
async def create_user(user: UserInputSchema, session: SessionDep) -> None:
    user = await create_user_crud(user, session)
    return f"user created {user}"


@router.patch("/{id}")
async def update_user(id: int, user: UserInputSchema, session: SessionDep):
    user = await update_user_crud(
        id=id,
        user_data=user,
        session=session,
    )
    return {"user": user}


@router.delete("/{id}")
async def delete_user(id: int) -> dict:
    return {"deleted": True}
