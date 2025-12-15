# app/api/history.py
from typing import List, Optional
from fastapi import APIRouter, Query, Depends
from sqlmodel import Session, select, desc
from app.services.db import get_session
from app.services.models import Frame, Plate, Video

router = APIRouter(prefix="/history", tags=["history"])


@router.get("/frames")
def get_frames(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session)
):
    """Get paginated list of frames with detection counts"""
    statement = select(Frame).order_by(desc(Frame.captured_at)).offset(offset).limit(limit)
    frames = session.exec(statement).all()
    
    # Count total frames
    total = session.exec(select(Frame)).all()
    
    return {
        "frames": [
            {
                "id": f.id,
                "image_url": f.image_url,
                "captured_at": f.captured_at.isoformat(),
                "vehicle_count": f.vehicle_count,
                "plate_count": f.plate_count,
            }
            for f in frames
        ],
        "total": len(total),
        "limit": limit,
        "offset": offset,
    }


@router.get("/frames/{frame_id}")
def get_frame_detail(
    frame_id: int,
    session: Session = Depends(get_session)
):
    """Get frame with all related plates"""
    frame = session.exec(
        select(Frame).where(Frame.id == frame_id)
    ).first()
    
    if not frame:
        return {"error": "Frame not found"}
    
    plates = session.exec(
        select(Plate).where(Plate.frame_id == frame_id)
    ).all()
    
    return {
        "id": frame.id,
        "image_url": frame.image_url,
        "captured_at": frame.captured_at.isoformat(),
        "vehicle_count": frame.vehicle_count,
        "plate_count": frame.plate_count,
        "raw_meta": frame.raw_meta,
        "plates": [
            {
                "id": p.id,
                "plate_text": p.plate_text,
                "confidence": p.confidence,
                "bbox_vehicle": p.bbox_vehicle,
                "bbox_plate": p.bbox_plate,
            }
            for p in plates
        ],
    }


@router.get("/plates")
def get_plates(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session)
):
    """Get paginated list of all detected plates"""
    statement = select(Plate).order_by(desc(Plate.created_at)).offset(offset).limit(limit)
    plates = session.exec(statement).all()
    
    # Count total plates
    total = session.exec(select(Plate)).all()
    
    return {
        "plates": [
            {
                "id": p.id,
                "frame_id": p.frame_id,
                "plate_text": p.plate_text,
                "confidence": p.confidence,
                "created_at": p.created_at.isoformat(),
                "bbox_vehicle": p.bbox_vehicle,
                "bbox_plate": p.bbox_plate,
            }
            for p in plates
        ],
        "total": len(total),
        "limit": limit,
        "offset": offset,
    }


@router.get("/stats")
def get_stats(session: Session = Depends(get_session)):
    """Get overall detection statistics"""
    frames = session.exec(select(Frame)).all()
    plates = session.exec(select(Plate)).all()
    videos = session.exec(select(Video)).all()
    
    total_vehicles = sum(f.vehicle_count for f in frames)
    total_plates = sum(f.plate_count for f in frames)
    video_vehicles = sum(v.vehicle_count for v in videos if v.status == "completed")
    video_plates = sum(v.plate_count for v in videos if v.status == "completed")
    
    return {
        "total_frames": len(frames),
        "total_videos": len(videos),
        "completed_videos": sum(1 for v in videos if v.status == "completed"),
        "total_vehicles_detected": total_vehicles + video_vehicles,
        "total_plates_detected": total_plates + video_plates,
        "total_plate_records": len(plates),
    }


@router.get("/videos")
def get_videos(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session)
):
    """Get paginated list of video jobs"""
    statement = select(Video).order_by(desc(Video.created_at)).offset(offset).limit(limit)
    videos = session.exec(statement).all()
    
    # Count total videos
    total = session.exec(select(Video)).all()
    
    return {
        "videos": [
            {
                "id": v.id,
                "job_id": v.job_id,
                "filename": v.filename,
                "task": v.task,
                "status": v.status,
                "vehicle_count": v.vehicle_count,
                "plate_count": v.plate_count,
                "total_frames": v.total_frames,
                "output_video_url": v.output_video_url,
                "created_at": v.created_at.isoformat(),
                "completed_at": v.completed_at.isoformat() if v.completed_at else None,
            }
            for v in videos
        ],
        "total": len(total),
        "limit": limit,
        "offset": offset,
    }


@router.get("/videos/{video_id}")
def get_video_detail(
    video_id: int,
    session: Session = Depends(get_session)
):
    """Get video job details"""
    video = session.exec(
        select(Video).where(Video.id == video_id)
    ).first()
    
    if not video:
        return {"error": "Video not found"}
    
    return {
        "id": video.id,
        "job_id": video.job_id,
        "filename": video.filename,
        "task": video.task,
        "status": video.status,
        "vehicle_count": video.vehicle_count,
        "plate_count": video.plate_count,
        "total_frames": video.total_frames,
        "input_video_url": video.input_video_url,
        "output_video_url": video.output_video_url,
        "raw_meta": video.raw_meta,
        "created_at": video.created_at.isoformat(),
        "updated_at": video.updated_at.isoformat(),
        "completed_at": video.completed_at.isoformat() if video.completed_at else None,
    }
