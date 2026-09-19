from datetime import datetime, timedelta, timezone
from backend.models.user import User
import jwt

from backend.api.deps import SessionDep
from backend.core.security import verify_password
from backend.repositories.users import get_user_by_login
from backend.schemas.auth import UserAuthSchema


from backend.core.config import config, get_logger

log = get_logger(__name__)

def create_access_token(
    data: dict, expires_delta: timedelta = config.auth.access_token_expire_minutes
):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, config.auth.secret_key, algorithm=config.auth.algorithm
    )
    return encoded_jwt


async def authenticate_user(login: str, password: str, session: SessionDep) -> User:
    user = await get_user_by_login(login=login, session=session)
    if not user:
        log.warning("User is not found %s , %s", password, config.auth.dummy_hash.strip())
        verify_password(password, config.auth.dummy_hash)
        return False
    if not verify_password(password, user.password):
        log.error("Incorrect password for user %s", user.login)
        return False
    return user
