from datetime import datetime, timezone
from backend.api.deps import SessionDep
from backend.core.config import get_logger
from backend.models.friends import Friends
from backend.models.user import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

log = get_logger(__name__)


async def get_all_friends(
    current_user_id: int, session: AsyncSession
) -> list[User | None]:
    friends_ids = await get_all_friends_ids(
        current_user_id=current_user_id, session=session
    )
    friends = await get_friends_by_ids(user_ids=friends_ids, session=session)
    return friends


async def get_all_friends_ids(current_user_id: int, session: AsyncSession) -> list[int]:
    log.info("current_user_id %s", current_user_id)
    stmt = (
        select(Friends)
        .where(
            (Friends.user1_id == current_user_id)
            | (Friends.user2_id == current_user_id)
        )
        .where(Friends.accepted_at != None)
    )
    friends_list = (await session.execute(stmt)).scalars().all()
    friends_ids = []
    if friends_ids == None:
        return
        # TODO: add logic
    for couple in friends_list:
        if couple.accepted_at == None:
            continue
        friends_ids += [couple.user1_id, couple.user2_id]

    if current_user_id in friends_ids:
        friends_ids.remove(current_user_id)

    log.info(friends_ids)
    return friends_ids


async def get_friends_by_ids(
    user_ids: list[int], session: AsyncSession
) -> list[User | None]:
    users: list[User | None] = []
    for id in user_ids:
        user: User | None = await session.get(User, id)
        users.append(user)
    return users


async def add_friend(requester_id1: int, user_id2: int, session: AsyncSession) -> bool:
    friend_request = await get_friend_request_if_exists(
        user_id1=requester_id1,
        user_id2=user_id2,
        session=session,
    )
    log.info("checked for friend request: %s", friend_request)
    if friend_request is not None:
        log.info("Friend request already created...")
        if requester_id1 != friend_request.requested_by:
            log.info("Already sended request")
            log.info("Accepting")
            friend_request.accepted_at = datetime.now(timezone.utc)
            try:
                await session.commit()
            except Exception as ex:
                log.error(ex)
        # if friend_request.accepted_at == None:
        # if friend_request.
        # TODO: ADD LOGIC IF REQUEST IS CREATED
    stmt = select(User).where(User.id.in_([requester_id1, user_id2]))
    result = await session.execute(stmt)
    if len(result.all()) == 2:
        log.info(
            "Пользователя 2, создается инвайт линк"
        )  # TODO: убрать отладочный принт
        ordered_users_ids = sorted([requester_id1, user_id2])
        friends = Friends(
            user1_id=ordered_users_ids[0],
            user2_id=ordered_users_ids[1],
            requested_by=requester_id1,
        )
        try:
            session.add(friends)
            await session.commit()
            return True
        except Exception as ex:
            log.error(ex)
    return False


async def get_friend_request_if_exists(
    user_id1: int, user_id2: int, session: AsyncSession
) -> Friends | None:
    # friend_status = await session.get(Friends, (user_id1, user_id2))

    stmt = select(Friends).where(
        (Friends.user1_id == user_id1) | (Friends.user2_id == user_id2)
    )
    friend_status = await session.execute(stmt)
    friend_status = friend_status.scalar_one_or_none()
    log.info("finded friends %s", friend_status)
    if friend_status:
        log.info(friend_status)
        return friend_status
    return None


async def remove_friend(
    current_user_id: int, friend_id: int, session: SessionDep
) -> bool:
    sorted_user_ids: list[int] = sorted([current_user_id, friend_id])
    stmt = select(Friends).where(
        (Friends.user1_id == sorted_user_ids[0])
        | (Friends.user2_id == sorted_user_ids[1])
    )

    try:
        friend_link = await session.execute(stmt)
        friend_link = friend_link.scalar_one_or_none()
        await session.delete(friend_link)
        await session.commit()
        return True
    except Exception as ex:
        log.error(ex)


async def get_all_friends_requests(current_user_id: int, session: SessionDep):
    stmt = select(Friends).where((Friends.user1_id == current_user_id) | (Friends.user2_id == current_user_id) ) #.join(User)
    friend_requests = await session.execute(stmt)
    all_requests = []
    for couple in list(friend_requests.scalars().all()):
        friend_id = couple.user1_id if couple.user1_id != current_user_id else couple.user2_id
        friend_data = (friend_id, couple.accepted_at)
        log.info("couple: %s", friend_data)
        all_requests.append(friend_data)
    return all_requests

