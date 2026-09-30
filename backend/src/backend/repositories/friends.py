from backend.core.config import get_logger
from backend.models.friends import Friends
from backend.models.user import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from typing import Annotated, Any, Dict, List
log = get_logger(__name__)

async def list_all_friend(current_user_id: int, session: AsyncSession) -> List[User]:
    stmt = select(Friends).where(Friends.user1_id == current_user_id)
    friends_list = (await session.execute(stmt)).scalars()
    return friends_list


async def add_friend(requester_id1: int, user_id2: int, session: AsyncSession) -> bool:
    friend_request = await get_friend_request_if_exists(
        user_id1=requester_id1,
        user_id2=user_id2,
        session=session,
    )
    if friend_request is not None:
        log.info("Friend request already created...")
        if friend_request.accepted_at == None:
            # if friend_request.
            ...  # TODO: ADD LOGIC IF REQUEST IS CREATED
    stmt = select(User).where(User.id.in_([requester_id1, user_id2]))
    result = await session.execute(stmt)
    if len(result.all()) == 2:
        log.info(
            "Пользователя 2, создается инвайт линк"
        )  # TODO: убрать отладочный принт
        friends = Friends(
            requested_by=requester_id1,
            user1_id=requester_id1,
            user2_id=user_id2,
        )
        session.add(friends)
        await session.commit()
        return True
    return False


async def get_friend_request_if_exists(
    user_id1: int, user_id2: int, session: AsyncSession
) -> Friends | None:
    friend_status = await session.get(Friends, (user_id1, user_id2))
    if friend_status:
        return friend_status
    return None
