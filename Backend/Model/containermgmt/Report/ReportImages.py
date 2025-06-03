from sqlalchemy import Column, String, Text, ForeignKey, Integer
from ...db import Base # Adjust this import path based on your project
from sqlalchemy.orm import relationship


class ReportImage(Base):
    __tablename__ = 'report_images'
    __table_args__ = {'schema': 'containermgmt'}

    id = Column(Integer, primary_key=True, autoincrement=True)
    DMGP_id = Column(String(20), ForeignKey('containermgmt.damageproduct.id'), nullable=True)
    path = Column(Text, nullable=False)

    # Optional: define relationship to DamageProduct
    damage_product = relationship("DamageProduct", back_populates="images")