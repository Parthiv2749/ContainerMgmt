from pydantic import BaseModel, Field


class ContainerDocumentSchema(BaseModel):
    docs_id: int
    path: str

    class Config:
        from_attributes = True
