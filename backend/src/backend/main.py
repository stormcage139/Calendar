import uvicorn
from fastapi import FastAPI

from backend.api.v1.routers import (
    auth_router,
    event_router,
    friends_router,
    user_router,
)
from backend.core.config import config, get_logger

log = get_logger(__name__)

app = FastAPI()

app.include_router(user_router, tags=["users_debug"])
app.include_router(auth_router, tags=["auth"])
app.include_router(friends_router, tags=["friends"], prefix="/friends")
app.include_router(event_router, tags=["events"], prefix="/events")

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
