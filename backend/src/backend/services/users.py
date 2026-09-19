from pydantic import BaseModel, ConfigDict

class UserInputSchema(BaseModel):
    model_config = ConfigDict(extra='ignore')
    login: str
    email: str
    password: str
    