import datetime

from pydantic import BaseModel, ConfigDict


class EventInputSchema(BaseModel):
    name: str
    online: bool = False
    deadline: datetime.datetime

class EventOutputSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    online: bool
    deadline: datetime.datetime




