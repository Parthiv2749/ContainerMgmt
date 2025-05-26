from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List
from .ContailerDocumenSchema import ContainerDocumentSchema

class ContainerDetailsSchema(BaseModel):
    container_id: int = Field(..., alias="Container_ID")
    container_no: str
    supplier: Optional[int]
    material: Optional[str]
    arrival_on_port: Optional[date]
    docs: Optional[int]
    type: Optional[int]
    in_bound: Optional[datetime]
    emptied_at: Optional[int]
    empty_date: Optional[date]
    out_bound: Optional[datetime]
    unloaded_at_port: Optional[date]
    note: Optional[str]
    status: Optional[int]
    consignee: Optional[int]
    tax: Optional[int]
    PONo: Optional[str]
    
    documents: List[ContainerDocumentSchema] = []
    class Config:
        from_attributes = True
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            date: lambda v: v.isoformat() if v else None,
        }
