from typing import Optional, List, Dict, Any
from datetime import datetime

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB  # <-- important


class Frame(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    image_url: str
    captured_at: datetime = Field(default_factory=datetime.utcnow)
    vehicle_count: int
    plate_count: int

    # store arbitrary metadata as JSONB
    raw_meta: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB)
    )

    plates: List["Plate"] = Relationship(back_populates="frame")


class Plate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    frame_id: int = Field(foreign_key="frame.id")
    plate_text: str
    confidence: float

    # bounding boxes as JSONB
    bbox_vehicle: Dict[str, float] = Field(
        sa_column=Column(JSONB)
    )
    bbox_plate: Dict[str, float] = Field(
        sa_column=Column(JSONB)
    )

    created_at: datetime = Field(default_factory=datetime.utcnow)

    frame: Frame = Relationship(back_populates="plates")
