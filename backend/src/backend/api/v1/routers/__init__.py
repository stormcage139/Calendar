from .user import router as user_router
from .auth import router as auth_router
from .friends import router as friends_router
from .event import router as event_router

__all__ = (
    "user_router",
    "auth_router",
    "friends_router",
    "event_router",
)
