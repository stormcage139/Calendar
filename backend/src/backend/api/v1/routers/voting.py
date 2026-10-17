from typing import Annotated

from fastapi import APIRouter, Depends

from backend.api.deps import SessionDep
from backend.api.v1.routers.auth import get_current_user
from backend.api.v1.routers.errors import DOMAIN_ERRORS, to_http_error
from backend.core.config import get_logger
from backend.models.user import User
from backend.schemas.event import (
    CloseVotingSchema,
    DateOptionInputSchema,
    DateOptionOutputSchema,
    EventOutputSchema,
    ResultsSchema,
    VotesInputSchema,
)
from backend.services import event as event_service
from backend.services import voting as voting_service

log = get_logger(__name__)
# Mounted under /events: date options and the approval vote that picks the final one.
router = APIRouter()


@router.get("/{event_id}/options")
async def get_options(
    event_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> list[DateOptionOutputSchema]:
    try:
        return await voting_service.list_options(event_id, current_user, session)
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)


@router.post("/{event_id}/options")
async def propose_option(
    event_id: int,
    data: DateOptionInputSchema,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> DateOptionOutputSchema:
    try:
        return await voting_service.propose_option(event_id, data, current_user, session)
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)


@router.delete("/{event_id}/options/{option_id}")
async def delete_option(
    event_id: int,
    option_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> bool:
    try:
        await voting_service.delete_option(event_id, option_id, current_user, session)
        return True
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)


@router.post("/{event_id}/start-voting")
async def start_voting(
    event_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> EventOutputSchema:
    try:
        event = await voting_service.start_voting(event_id, current_user, session)
        return event_service.to_output(event)
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)


@router.put("/{event_id}/votes")
async def cast_votes(
    event_id: int,
    data: VotesInputSchema,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> list[DateOptionOutputSchema]:
    try:
        return await voting_service.cast_votes(
            event_id, data.date_option_ids, current_user, session
        )
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)


@router.get("/{event_id}/results")
async def get_results(
    event_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> ResultsSchema:
    try:
        return await voting_service.get_results(event_id, current_user, session)
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)


@router.post("/{event_id}/close")
async def close_voting(
    event_id: int,
    data: CloseVotingSchema,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep,
) -> ResultsSchema:
    try:
        return await voting_service.close_voting(
            event_id, data.date_option_id, current_user, session
        )
    except DOMAIN_ERRORS as ex:
        raise to_http_error(ex)
