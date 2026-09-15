class DB:
    url: str = "sqlite+aiosqlite:///calendar_data.db"


class Config:
    db: DB = DB()
    
    
    
config = Config()
    
    
