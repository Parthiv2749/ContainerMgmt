from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy import Integer, String, Date, DateTime, Text, SmallInteger, ForeignKey
from ...db import Base
from typing import List, Optional

class ContainerDetails(Base):
    __tablename__ = 'container_details'
    __table_args__ = {'schema': 'containermgmt'}

    Container_ID: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    container_no: Mapped[str] = mapped_column(String(50), nullable=False)

    supplier: Mapped[Optional[int]] = mapped_column(ForeignKey('containermgmt.supplier.supplier_id'), nullable=True)
    material: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    arrival_on_port: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)

    docs: Mapped[Optional[int]] = mapped_column(ForeignKey('containermgmt.shipping_document.doc_id'), nullable=True)
    type: Mapped[Optional[int]] = mapped_column(ForeignKey('containermgmt.container_type.type_id'), nullable=True)

    in_bound: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    emptied_at: Mapped[Optional[int]] = mapped_column(ForeignKey('containermgmt.unload_venue.venue_id'), nullable=True)
    empty_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)

    out_bound: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    unloaded_at_port: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    consignee: Mapped[Optional[int]] = mapped_column(ForeignKey('containermgmt.consignee.consignee_id'), nullable=True)
    tax: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    PONo: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

    # Relationships
    documents: Mapped[List["ContainerDocs"]] = relationship(
        "ContainerDocs", back_populates="container", cascade="all, delete-orphan"
    )
    reports = relationship("ReportDetails", back_populates="container")
