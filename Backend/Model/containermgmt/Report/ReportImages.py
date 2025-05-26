from sqlalchemy import Column, String, Text, Integer,ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from ...db import Base


class ReportImages(Base):
    __tablename__ = 'report_images'
    __table_args__ = {'schema': 'containermgmt'}

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(String(45), ForeignKey('containermgmt.report_details.report_id'))
    image = Column(Text)

    report = relationship("ReportDetails", back_populates="images")
