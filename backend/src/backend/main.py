from fastapi import FastAPI
import uvicorn

from backend.api.v1.routers import user_router
from backend.api.v1.routers import auth_router
from backend.api.v1.routers import friends_router
from backend.core.config import get_logger, config

log = get_logger(__name__)

app = FastAPI()

app.include_router(user_router, tags=["users"])
app.include_router(auth_router, tags=["auth"])
app.include_router(friends_router, tags=["friends"], prefix="/friends")

@app.get("/ping")
def pong() -> str:
    return "pong"


if __name__ == "__main__":
    log.info("Application started")
    log.info("current db is %s", config.db.url)
    uvicorn.run(
        "main:app",
        reload=True,
    )
