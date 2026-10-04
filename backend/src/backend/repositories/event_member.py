from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import SessionDep
from backend.core.config import get_logger
from backend.models.event import Event
from backend.models.event_members import EventMember
from backend.models.friends import Friends
from backend.models.user import User


async def create_invite_to_event(current_user_id, session: AsyncSession) -> Event:
    pass
