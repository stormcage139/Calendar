from datetime import datetime, timezone
from backend.api.deps import SessionDep
from backend.core.config import get_logger
from backend.models.event import Event
from backend.models.event_members import EventMember
from backend.models.friends import Friends
from backend.models.user import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

log = get_logger(__name__)


async def get_all_user_events(current_user_id, session: AsyncSession) -> list[Event]:

    stmt = select(EventMember).where(EventMember.user)
