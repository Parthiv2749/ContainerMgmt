
from sqlalchemy import Column, String,Integer
# from sqlalchemy.orm import relationship
from ...db import Base

class ShippingDocument(Base):
    __tablename__ = 'shipping_document'
    __table_args__ = {'schema': 'containermgmt'}

    doc_id = Column(Integer, primary_key=True)
    doc_type = Column(String(45))