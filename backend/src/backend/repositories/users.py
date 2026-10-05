
from sqlalchemy.exc import IntegrityError

from backend.core.config import get_logger
from backend.core.security import get_password_hash, password_hash
from backend.exceptions import AlreadyExistsError
from backend.models.user import User
from backend.schemas.users import UserInputSchema
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

log = get_logger(__name__)


async def get_user_by_login(login: str, session: AsyncSession) -> User | None:
    try: 
        stmt = select(User).where(User.login == login)
        user = await session.execute(stmt)
        return user.scalar()
    except Exception as ex:
        log.exception(ex)
        await session.rollback()

async def create_user(user_data: UserInputSchema, session: AsyncSession) -> User:
    try:
        user_data.password = get_password_hash(user_data.password)
        new_user = User(**user_data.model_dump())
        session.add(new_user)
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise AlreadyExistsError("User already exists") from exc
    except Exception as ex:
        log.exception(f"cought unexpected error")
        await session.rollback()
        raise

    return new_user


async def update_user(
    id: int, user_data: UserInputSchema, session: AsyncSession
) -> User | None:
    try:
        user = await session.get(User, id)
        for key, value in user_data.model_dump().items():
            log.info(key, value) 
            if key == "password":
                value = get_password_hash(value)
            setattr(user, key, value)
        await session.commit()
        return user
    except Exception as ex:
        log.error(ex)


async def delete_user(id: int, session: AsyncSession) -> bool:
    try:
        stmt = delete(User).where(User.id == id)
        await session.execute(stmt)
        await session.commit()
        return True
    except Exception as ex:
        log.exception(ex)
        return False
