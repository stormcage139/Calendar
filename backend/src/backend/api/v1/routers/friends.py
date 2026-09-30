from typing import Annotated, Any, Dict, List

from backend.api.v1.routers.auth import get_current_user
from backend.repositories.friends import add_friend
from fastapi import APIRouter, Depends
from backend.repositories.friends import list_all_friend
from backend.api.deps import SessionDep
from backend.models.user import User
from backend.schemas.users import UserInputSchema
from backend.repositories.users import (
    create_user as create_user_crud,
    update_user as update_user_crud,
    delete_user as delete_user_crud,
)

router = APIRouter()


@router.get("")
async def get_all_friends(
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> List[Any] | None:
    all_friends = await list_all_friend(current_user_id=current_user.id, session=session)
    for user in all_friends:
        
@router.post("/{new_friend_id}")
async def send_friend_request(
    new_friend_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> List[Any] | None:
    await add_friend(current_user.id, new_friend_id, session=session)


@router.delete("/{id}")
async def delete_friend(
    current_user: Annotated[User, Depends(get_current_user)],
    other_user_id: int,
    session: SessionDep,
):
    pass
    # TODO: add logic
