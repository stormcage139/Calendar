import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict

class RequestType(Enum):
    INCOMING="incoming"
    OUTGOING='outgoing'

class FriendSchema(BaseModel):
    id: int
    login: str
    email: str
    accepted_at: datetime.datetime


class FriendRequestSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    # user:FriendSchema
    # from_user: int
    new_freind_id: int
    type: RequestType
    # to_user: int
    # accepted: bool = False 
    accepted_date: datetime.datetime| None = None
