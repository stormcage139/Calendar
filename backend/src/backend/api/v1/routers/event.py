from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response
from fastapi.exceptions import HTTPException
from fastapi.security.http import HTTPBasic
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.status import HTTP_503_SERVICE_UNAVAILABLE

from backend.api.deps import SessionDep
from backend.api.v1.routers.auth import get_current_user
from backend.api.v1.routers.errors import DOMAIN_ERRORS, to_http_error
from backend.core.config import get_logger
from backend.models import user
from backend.models.user import User
from backend.repositories.event import (
    create_event as create_event_crud,
    get_all_user_events as get_all_user_events_crud,
)
from backend.schemas.event import (
    EventDetailSchema,
    EventInputSchema,
    EventOutputSchema,
    EventUpdateSchema,
    InviteSchema,
)
from backend.repositories.result import get_result
from backend.services import event as event_service
from backend.services.voting import auto_close_if_due


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
        # Close votes whose deadline has passed before showing the list.
        for event in user_events:
            await auto_close_if_due(event, session)
        # Includes the final date of completed events.
        events_list: list[EventOutputSchema] = await event_service.list_user_events(
            current_user, session
        )
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
        # Adds the creator as a joined member and invites `invite_logins`.
        return await event_service.create_event(event, current_user, session)
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)
    except Exception as ex:
        log.error("error in router when creating new event, %s", ex)
        raise HTTPException(status_code=HTTP_503_SERVICE_UNAVAILABLE)


async def _detail(event_id: int, user: User, session) -> EventDetailSchema:
    event = await event_service.load_event_for_user(event_id, user, session)
    awaiting_creator = await auto_close_if_due(event, session)
    result = await get_result(event.id, session=session)
    return event_service.to_detail(event, user, result, awaiting_creator)


@router.get("/{event_id}")
async def get_event(
    event_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> EventDetailSchema:
    try:
        return await _detail(event_id, current_user, session)
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)


@router.patch("/{event_id}")
async def update_event(
    event_id: int,
    data: EventUpdateSchema,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> EventDetailSchema:
    try:
        await event_service.update_event(event_id, data, current_user, session)
        return await _detail(event_id, current_user, session)
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)


@router.post("/{event_id}/cancel")
async def cancel_event(
    event_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> EventDetailSchema:
    try:
        await event_service.cancel_event(event_id, current_user, session)
        return await _detail(event_id, current_user, session)
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)


@router.post("/{event_id}/invite")
async def invite_to_event(
    event_id: int,
    data: InviteSchema,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> EventDetailSchema:
    try:
        await event_service.invite_users(event_id, data.logins, current_user, session)
        return await _detail(event_id, current_user, session)
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)


@router.post("/{event_id}/accept")
async def accept_invite(
    event_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> EventDetailSchema:
    try:
        await event_service.accept_invite(event_id, current_user, session)
        return await _detail(event_id, current_user, session)
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)


@router.post("/{event_id}/decline")
async def decline_invite(
    event_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> bool:
    try:
        await event_service.decline_invite(event_id, current_user, session)
        return True
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)
