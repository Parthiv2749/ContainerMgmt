from sqlalchemy import Column, String, Integer
from sqlalchemy.orm import relationship
from ...db import Base

class Consignee(Base):
    __tablename__ = 'consignee'
    __table_args__ = {'schema': 'containermgmt'}

    consignee_id = Column(Integer, primary_key=True)
    consignee_name = Column(String(45))