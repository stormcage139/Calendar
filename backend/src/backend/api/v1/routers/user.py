from typing import Dict

from fastapi import APIRouter

from backend.api.deps import SessionDep
from backend.models.user import User
from backend.schemas.users import UserInputSchema
from backend.repositories.users import (
    create_user as create_user_crud,
    update_user as update_user_crud,
    delete_user as delete_user_crud
)

# from backend.repositories import
router = APIRouter(prefix="/users")


@router.get("/{id}")
async def get_all_users(id: int, session: SessionDep):
    return {"user": str(await session.get(User, id))}


@router.post("")
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
async def delete_user(id: int, session: SessionDep) -> dict:
    status = await delete_user_crud(id=id, session=session)
    return {"deleted": status}
    
