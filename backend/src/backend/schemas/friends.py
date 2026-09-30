import datetime

from pydantic import BaseModel, ConfigDict

class FriendSchema(BaseModel):
    id: int
    login: str
    email: str
    accepted_at: datetime.datetime

