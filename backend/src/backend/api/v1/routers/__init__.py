from .user import router as user_router
from .auth import router as auth_router
from .friends import router as friends_router
__all__ = (
    "user_router",
    "auth_router",
    "friends_router",
)
