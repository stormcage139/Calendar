

from backend.core.config import get_logger
from backend.models.user import User
from backend.services.users import UserInputSchema
from sqlalchemy.ext.asyncio import AsyncSession

log = get_logger(__name__)


async def create_user(user_data: UserInputSchema, session: AsyncSession) -> User:
    try:
        new_user = User(**user_data.model_dump())
        session.add(new_user)
        await session.commit()
    except Exception as ex:
        log.error(f"Cant create user because of :{ex}")
        await session.rollback()
        raise
    return new_user


async def update_user(id: int, user_data: UserInputSchema, session: AsyncSession) -> User:
    try: 
        user = await session.get(User, id)
        for key, value in user_data.model_dump().items():
            print(key, value)
            setattr(user, key, value)
        await session.commit()
        return user
    except Exception as ex:
        log.error(ex)
        
    
    
    
async def delete_user(id: int, session: AsyncSession):
    try: 
        user = await session.get(User, id)
        await session.delete(user)
        await session.commit()
    except Exception as ex:
        log.error(ex)
        