# app/api/infer_image.py
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from sqlmodel import Session

from app.services.inference import run_image_pipeline
from app.services.storage import upload_frame
from app.services.db import get_session
from app.services.models import Frame, Plate

router = APIRouter(prefix="/infer/image", tags=["infer-image"])


def _parse_roi(roi_str: Optional[str]) -> Optional[Dict[str, int]]:
    if not roi_str:
        return None
    try:
        roi = json.loads(roi_str)
        for k in ["x1", "y1", "x2", "y2"]:
            if k not in roi:
                raise ValueError(f"Missing key {k} in ROI")
            roi[k] = int(roi[k])
        return roi
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid roi: {e}")


@router.post("")
async def infer_image(
    file: UploadFile = File(...),
    task: str = Form("vehicle_detection"),  # "vehicle_detection" | "plate_recognition"
    roi: Optional[str] = Form(None),
):
    task = task.strip()
    if task not in ("vehicle_detection", "plate_recognition"):
        raise HTTPException(
            status_code=400,
            detail="task must be 'vehicle_detection' or 'plate_recognition'",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    roi_obj = _parse_roi(roi)

    try:
        # Run main pipeline
        result = run_image_pipeline(image_bytes, task=task, roi=roi_obj)

        annotated_bytes = result["image_bytes_annotated"]
        image_url = upload_frame(annotated_bytes, ext="png")

        # Extract meta
        raw_meta: Dict[str, Any] = result.get("raw_meta") or {}

        # Vehicles and plates from pipeline / raw_meta
        vehicles = result.get("vehicles") or raw_meta.get("vehicles", []) or []
        plates = result.get("plates", [])

        # Counts
        vehicle_count = int(result.get("vehicle_count", len(vehicles)))
        plate_count = int(result.get("plate_count", len(plates)))

        # Build detections array for frontend table
        detections = []
        for v in vehicles:
            bbox_v = v.get("bbox_vehicle") or v.get("bbox") or {}
            x1 = bbox_v.get("x1")
            y1 = bbox_v.get("y1")
            x2 = bbox_v.get("x2")
            y2 = bbox_v.get("y2")
            if None in (x1, y1, x2, y2):
                continue

            detections.append(
                {
                    "bbox": [float(x1), float(y1), float(x2), float(y2)],
                    "score": float(v.get("confidence", 1.0)),
                    "class_id": int(v.get("class_id", 0)),
                }
            )

        # Optional fallback: if no vehicle boxes but you have plates, expose plate boxes
        if not detections and plates:
            for p in plates:
                bbox_p = p.get("bbox_plate") or {}
                x1 = bbox_p.get("x1")
                y1 = bbox_p.get("y1")
                x2 = bbox_p.get("x2")
                y2 = bbox_p.get("y2")
                if None in (x1, y1, x2, y2):
                    continue

                detections.append(
                    {
                        "bbox": [float(x1), float(y1), float(x2), float(y2)],
                        "score": float(p.get("confidence", 1.0)),
                        "class_id": 1,  # treat 1 as plate
                    }
                )

        # Persist to DB (unchanged except using raw_meta)
        with get_session() as session:  # type: Session
            frame = Frame(
                image_url=image_url,
                vehicle_count=vehicle_count,
                plate_count=plate_count,
                raw_meta=raw_meta,
            )
            session.add(frame)
            session.flush()

            for p in plates:
                plate = Plate(
                    frame_id=frame.id,
                    plate_text=p["plate_text"],
                    confidence=float(p["confidence"]),
                    bbox_vehicle=p["bbox_vehicle"],
                    bbox_plate=p["bbox_plate"],
                )
                session.add(plate)

            session.commit()
            session.refresh(frame)

        # Extended response: KEEP old fields, ADD front-end friendly fields
        detection_message = ""
        if len(detections) == 0:
            if task == "vehicle_detection":
                detection_message = "No vehicles detected"
            else:
                detection_message = "No number plates detected"
        
        return {
            # new generic fields
            "task": task,
            "count": len(detections),
            "detections": detections,
            "storage_url": image_url,  # alias of image_url for UI
            "message": detection_message,

            # existing fields (backwards compatible)
            "frame_id": frame.id,
            "image_url": image_url,
            "vehicle_count": vehicle_count,
            "plate_count": plate_count,
            "plates": plates,
            "roi": roi_obj,
            "local_path": result.get("local_path"),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"image inference failed: {e}")

