from pydantic import BaseModel
from typing import List

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    roles: List[str] = []

    class Config:
        from_attributes = True
