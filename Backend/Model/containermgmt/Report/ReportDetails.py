from sqlalchemy import Column, String, Date, Text, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

from ...db import Base

class ReportDetails(Base):
    __tablename__ = 'report_details'
    __table_args__ = {'schema': 'containermgmt'}

    report_id = Column(String(45), primary_key=True)
    container_id = Column(String(50), ForeignKey('containermgmt.container_details.container_no'))
    report_date = Column(Date, nullable=False)
    material_as_packing_list = Column(Text)
    damage_goods = Column(Text)
    comment = Column(Text)
    value_of_damage_good = Column(DECIMAL(10, 2))
    consignee = Column(String(100))

    container = relationship("ContainerDetails", back_populates="reports")
    images = relationship("ReportImages", back_populates="report")
