from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
import logging

logging.basicConfig(
    handlers=[logging.FileHandler("info.log"), logging.StreamHandler()],
    level=logging.INFO,
    format="[%(asctime)s] {%(pathname)s:%(lineno)d} %(levelname)s - %(message)s",
    datefmt="%H:%M:%S",
)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


class DatabaseSettings(BaseModel):
    url: str = "sqlite+aiosqlite:///./calendar_data.db"
    echo: bool = False
    pool_pre_ping: bool = True


class Config(BaseModel):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_nested_delimiter="__",
        extra="ignore",
    )
    db: DatabaseSettings = DatabaseSettings()


config = Config()
