from pwdlib import PasswordHash
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

class Auth(BaseModel):
    secret_key: str = "02395560f790d689584b884c02827346b164017d40307908c989d746d7beff8d"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    dummy_hash: str = "randomtexttofuckhackerslolyoucantdosmthwiththis"

class Config(BaseModel):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_nested_delimiter="__",
        extra="ignore",
    )
    db: DatabaseSettings = DatabaseSettings()
    auth: Auth = Auth()


config = Config()
