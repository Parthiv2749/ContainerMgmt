from sqlalchemy import Integer, Text, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column
from ...db import Base

class ContainerDocs(Base):
    __tablename__ = 'container_docs'
    __table_args__ = {'schema': 'containermgmt'}

    docs_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    container_id: Mapped[int] = mapped_column(ForeignKey('containermgmt.container_details.Container_ID'))
    path: Mapped[str] = mapped_column(Text)

    container: Mapped["ContainerDetails"] = relationship("ContainerDetails", back_populates="documents")
