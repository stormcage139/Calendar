from typing import Annotated, Any 

from backend.api.v1.routers.auth import get_current_user
from backend.repositories.friends import add_friend, remove_friend
from fastapi import APIRouter, Depends
from backend.repositories.friends import (
    get_all_friends as get_all_friends_crud,
)
from backend.api.deps import SessionDep
from backend.models.user import User
from backend.schemas.auth import UserOutSchema
from backend.core.config import get_logger

log = get_logger(__name__)
router = APIRouter()


@router.get("")
async def get_all_friends(
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> list[Any] | None:
    all_friends = await get_all_friends_crud(
        current_user_id=current_user.id, session=session
    )
    log.info("friends data %s", all_friends)
    all_users: list[UserOutSchema] = []
    for user in all_friends:
        log.info("user friends is %s", user)
        all_users.append(UserOutSchema.model_validate(user))
    return all_users


@router.post("/{new_friend_id}")
async def send_friend_request(
    new_friend_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> list[Any] | None:
    log.info("Request sended")
    await add_friend(current_user.id, new_friend_id, session=session)


@router.delete("/{friend_id}")
async def delete_friend(
    current_user: Annotated[User, Depends(get_current_user)],
    friend_id: int,
    session: SessionDep,
):
    status: bool = await remove_friend(current_user_id=current_user.id, friend_id=friend_id, session=session)
    return status
    # TODO: add logic
