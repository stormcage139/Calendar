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


log = get_logger(__name__)
router = APIRouter()


@router.get("/")
async def get_all_user_events(
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> Any:
    try:
        user_events = await get_all_user_events_crud(
            current_user_id=current_user.id,
            session=session,
        )
        log.info("get events %s", user_events)
        events_list: list[EventOutputSchema] = []
        for event in user_events:
            validated_event = EventOutputSchema.model_validate(event)
            events_list.append(validated_event)
        return events_list

    except Exception as ex:
        log.error("Cant get user events \n %s", ex)
        raise HTTPException(status_code=HTTP_503_SERVICE_UNAVAILABLE)


@router.post("/")
async def crete_new_event(
    event: EventInputSchema,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> EventOutputSchema:
    try:
        new_event = await create_event_crud(
            event=event,
            current_user_id=current_user.id,
            session=session,
        )
        return EventOutputSchema.model_validate(new_event)
    except Exception as ex:
        log.error("error in router when creating new event, %s", ex)
        raise HTTPException(status_code=HTTP_503_SERVICE_UNAVAILABLE)
