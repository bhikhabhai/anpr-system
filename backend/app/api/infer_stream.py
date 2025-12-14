# app/api/infer_stream.py
from typing import Optional, Dict, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.inference import run_stream_pipeline

router = APIRouter(prefix="/infer/stream", tags=["infer-stream"])


class ROI(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int


class StreamRequest(BaseModel):
    stream_url: str = Field(..., description="RTSP / HTTP camera URL")
    task: Literal["vehicle_detection", "plate_recognition"] = "vehicle_detection"
    roi: Optional[ROI] = None


@router.post("")
async def infer_stream(payload: StreamRequest):
    try:
        result = run_stream_pipeline(
            stream_url=payload.stream_url,
            task=payload.task,
            roi=payload.roi.dict() if payload.roi else None,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"stream inference failed: {e}")
