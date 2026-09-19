from pydantic import BaseModel, ConfigDict


class UserAuthSchema(BaseModel):
    model_config = ConfigDict(extra='ignore')
    login: str
    password: str
    
class UserOutSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    login: str
    email: str

class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    login: str 