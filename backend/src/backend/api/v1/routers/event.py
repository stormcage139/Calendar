from typing import Dict

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import SessionDep
from backend.models.user import User
from backend.schemas.users import UserInputSchema
from backend.repositories.users import (
    create_user as create_user_crud,
    update_user as update_user_crud,
    delete_user as delete_user_crud,
)

# from backend.repositories import
router = APIRouter(prefix="/events")
@router.get("/")
async def get_all_events(
    current_user_id: int, session: AsyncSession
):

