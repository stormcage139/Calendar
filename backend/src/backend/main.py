from fastapi import FastAPI
import uvicorn

from backend.api.v1.routers import user_router

app = FastAPI()

app.include_router(user_router)

@app.get("/test")
def test() -> None:
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app",reload=True)