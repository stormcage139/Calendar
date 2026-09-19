from fastapi import FastAPI
import uvicorn

from backend.api.v1.routers import user_router
from backend.api.v1.routers import auth_router

app = FastAPI()

app.include_router(user_router, tags=["users"])
app.include_router(auth_router, tags=["auth"])


@app.get("/ping")
def pong() -> str:
    return "pong"


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        reload=True,
    )
