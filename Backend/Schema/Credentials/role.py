from pydantic import BaseModel
from typing import List

class RoleBase(BaseModel):
    name: str

class RoleCreate(RoleBase):
    pass

class RoleOut(RoleBase):
    id: int
    permissions: List[str] = []

    class Config:
        from_attributes = True
