from typing import Dict  # noqa: I001

from fastapi import APIRouter
from fastapi.exceptions import HTTPException
from sqlalchemy import select
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR

from backend.api.deps import SessionDep
from backend.core.config import get_logger
from backend.exceptions import AlreadyExistsError
from backend.models.user import User
from backend.schemas.auth import UserOutSchema
from backend.schemas.users import UserInputSchema
from backend.repositories.users import (
    create_user as create_user_crud,
    update_user as update_user_crud,
    delete_user as delete_user_crud,
)

log = get_logger(__name__)
# from backend.repositories import
router = APIRouter(prefix="/users")


@router.get("/all")
async def get_all_users(session: SessionDep):
    stmt = select(User)
    result = await session.execute(stmt)
    result = result.scalars().all()
    all_users_validated= []
    for user in result:
        user = UserOutSchema.model_validate(user)
        all_users_validated.append(user)
    return all_users_validated

@router.post("")
async def create_user(user: UserInputSchema, session: SessionDep) -> None | str:
    try:
        new_user = await create_user_crud(user, session)
        return f"user created {new_user}"
    except AlreadyExistsError:
        log.exception("already exeists error")
        raise HTTPException(status_code=HTTP_500_INTERNAL_SERVER_ERROR, detail="login is already in use")
    except Exception as ex:
        log.exception(ex)
        raise HTTPException(status_code=HTTP_500_INTERNAL_SERVER_ERROR, detail="uknown error, try again later or connect with smbd")

@router.patch("/{id}")
async def update_user(id: int, user: UserInputSchema, session: SessionDep):
    updated_user = await update_user_crud(
        id=id,
        user_data=user,
        session=session,
    )
    return {"user": updated_user}


@router.delete("/{id}")
async def delete_user(id: int, session: SessionDep) -> dict:
    status = await delete_user_crud(id=id, session=session)
    return {"deleted": status}
