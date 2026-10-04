import datetime

from pydantic import BaseModel, ConfigDict

class FriendSchema(BaseModel):
    id: int
    login: str
    email: str
    accepted_at: datetime.datetime


class FriendRequestSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    # user:FriendSchema
    from_user: int
    to_user: int
    # accepted: bool = False 
    accepted_date: datetime.datetime| None = None
