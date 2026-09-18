from backend.api.deps import SessionDep
from backend.models.user import User
from fastapi import APIRouter

# from backend.repositories import
router = APIRouter()


@router.get("/users")
async def get_all_users(session: SessionDep):
    return {"user": str(await session.get(User, 1))}
