from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
