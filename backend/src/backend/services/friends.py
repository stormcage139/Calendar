from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_logger
from backend.models import Friends
from backend.schemas.friends import FriendRequestSchema, RequestType


log = get_logger(__name__)


def validate_friend_requests(current_user_id: int, friend_requests: list[Friends]) -> list[FriendRequestSchema]:
    all_requests = []
    for couple in list(friend_requests):

        if couple.requested_by == current_user_id:
            request_type = RequestType.OUTGOING 
            friend_id = couple.friend_id
        else:
            request_type = RequestType.INCOMING 
            friend_id = couple.requested_by
        friend_request = FriendRequestSchema(
            new_freind_id=friend_id,
            type=request_type,
            accepted_date=couple.accepted_at,
        )
        log.info("couple: %s", friend_request)
        all_requests.append(friend_request)
    return all_requests
