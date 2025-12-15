# app/api/infer_video.py
from __future__ import annotations

import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException

from app.core import supabase_client
from app.constants.video_status import VIDEO_STATUS
from app.services.inference import run_video_pipeline_and_store

supabase = supabase_client.supabase
router = APIRouter(prefix="/infer/video", tags=["Video"])

JOB_TABLE = "video_jobs"

@router.post("/")
async def infer_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    task: str = Form("vehicle_detect"),
    roi: Optional[str] = Form(None),
):
    video_bytes = await file.read()

    job = (
        supabase.table(JOB_TABLE)
        .insert({
            "task": task,
            "roi": json.loads(roi) if roi else None,
            "status": VIDEO_STATUS["UPLOAD_RECEIVED"],
            "progress_percent": 0,
            "cancelled": False,
            "created_at": datetime.utcnow().isoformat(),
        })
        .execute()
    )

    job_id = job.data[0]["id"]

    import threading
    threading.Thread(
        target=run_video_pipeline_and_store,
        kwargs=dict(
            job_id=job_id,
            video_bytes=video_bytes,
            task=task,
            roi=json.loads(roi) if roi else None,
        ),
        daemon=True,
    ).start()


    return {"job_id": job_id}

@router.get("/status/{job_id}")
async def get_status(job_id: str):
    max_retries = 3
    initial_delay = 0.5
    delay = initial_delay
    
    for attempt in range(max_retries):
        try:
            res = (
                supabase.table(JOB_TABLE)
                .select("id,status,progress_percent,video_url,vehicle_count,plate_count")
                .eq("id", job_id)
                .single()
                .execute()
            )
            if not res.data:
                raise HTTPException(404)

            return {
                "job_id": res.data["id"],
                "status": res.data["status"],
                "progress": res.data["progress_percent"],
                "annotated_video_url": res.data["video_url"],
                "vehicle_count": res.data.get("vehicle_count"),
                "plate_count": res.data.get("plate_count"),
            }
        except Exception as e:
            if attempt < max_retries - 1:
                import time
                import logging
                logging.warning(f"Status query failed (attempt {attempt + 1}/{max_retries}): {str(e)}")
                time.sleep(delay)
                delay *= 2
            else:
                # Return 503 Service Unavailable on final failure
                import logging
                logging.error(f"Status query failed after {max_retries} attempts for job {job_id}: {str(e)}")
                raise HTTPException(
                    status_code=503,
                    detail="Database temporarily unavailable. Please try again."
                )

@router.post("/cancel/{job_id}")
async def cancel_job(job_id: str):
    res = (
        supabase.table(JOB_TABLE)
        .update({
            "cancelled": True,
            "status": VIDEO_STATUS["FAILED"],
            "cancelled_at": datetime.utcnow().isoformat(),
        })
        .eq("id", job_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404)

    return {"job_id": job_id, "status": "cancelled"}
