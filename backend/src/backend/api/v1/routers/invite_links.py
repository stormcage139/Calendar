from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response
from fastapi.exceptions import HTTPException
from fastapi.security.http import HTTPBasic
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.status import HTTP_503_SERVICE_UNAVAILABLE

from backend.api.deps import SessionDep
from backend.api.v1.routers.auth import get_current_user
from backend.core.config import get_logger
from backend.models import user
from backend.models.user import User
from backend.repositories.event import (
    create_event as create_event_crud,
    get_all_user_events as get_all_user_events_crud,
)
from backend.schemas.event import EventInputSchema, EventOutputSchema

router = APIRouter()



@router.get("/mylinks")
async def get_my_links(
    current_user: Annotated[User, Depends(get_current_user)]
):
    pass
