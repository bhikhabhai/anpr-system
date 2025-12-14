# app/services/inference.py
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import os
import cv2
import numpy as np
import onnxruntime as ort
import logging
import tempfile
import uuid
import shutil
import concurrent.futures
import json

from app.core import supabase_client
from app.core.config import settings
from app.constants.video_status import VIDEO_STATUS
from typing import Tuple
import subprocess

import subprocess


# ----------------- JOB STATUS ENUM -----------------

def reencode_ffmpeg(src_path: str, dst_path: str, crf: int = 24, max_width: int = 1280, fps: int = 25,
                    target_bitrate: str = "800k", maxrate: str = "800k", bufsize: str = "1600k"):
    # Scale filter: maintain aspect ratio but cap to max_width
    # Format: scale=min(iw,max_width):min(ih,max_width*ih/iw)
    vf = f"scale=min(iw\\,{max_width}):min(ih\\,{max_width}*ih/iw)"

    cmd = [
        "ffmpeg", "-y",
        "-i", src_path,
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", str(crf),
        "-vf", vf,
        "-r", str(fps),
        "-an",              # remove audio
        "-b:v", target_bitrate,
        "-maxrate", maxrate,
        "-bufsize", bufsize,
        dst_path
    ]

    try:
        # check if ffmpeg exists
        import shutil
        if shutil.which("ffmpeg") is None:
            raise RuntimeError("ffmpeg not found in system PATH. Install ffmpeg to enable video re-encoding.")
        
        proc = subprocess.run(cmd, check=True, capture_output=True, text=True)
    except FileNotFoundError:
        raise RuntimeError("ffmpeg executable not found. Please install ffmpeg and add it to PATH.") from None
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr or f"(no stderr captured - rc={e.returncode})"
        raise RuntimeError(f"ffmpeg re-encoding failed:\n{error_msg}") from e

def _update_job_status(job_id: str, status: str, extra: dict = None):
    try:
        payload = {"status": status}
        if extra:
            payload.update(extra)

        supabase.table(JOB_TABLE).update(payload).eq("id", job_id).execute()
    except Exception as e:
        logger.warning("Failed to update job status: %s", e)


logger = logging.getLogger(__name__)

# ----------------- PATHS -----------------
BASE_DIR = Path(__file__).resolve().parents[2]
MODELS_DIR = BASE_DIR / "models"
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

# adjust filename if your ONNX file is named differently
VEHICLE_MODEL_PATH = MODELS_DIR / "vehicle_detector.onnx"

# ----------------- MODEL SESSIONS -----------------
# If you have GPU, replace providers with ["CUDAExecutionProvider","CPUExecutionProvider"]
vehicle_session = ort.InferenceSession(
    str(VEHICLE_MODEL_PATH),
    providers=["CPUExecutionProvider"],
)

# ----------------- HYPERPARAMS -----------------
IMG_SIZE = 640
CONF_THRES = 0.30
IOU_THRES = 0.35

# ----------------- HELPERS -----------------
def _decode_image(image_bytes: bytes) -> np.ndarray:
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img


def _apply_roi(img: np.ndarray, roi: Optional[Dict[str, int]]) -> np.ndarray:
    if not roi:
        return img
    h, w, _ = img.shape
    x1 = max(0, min(w, int(roi.get("x1", 0))))
    y1 = max(0, min(h, int(roi.get("y1", 0))))
    x2 = max(0, min(w, int(roi.get("x2", w))))
    y2 = max(0, min(h, int(roi.get("y2", h))))
    if x2 <= x1 or y2 <= y1:
        return img
    return img[y1:y2, x1:x2].copy()


def _box_iou(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    inter_x1 = np.maximum(a[:, None, 0], b[None, :, 0])
    inter_y1 = np.maximum(a[:, None, 1], b[None, :, 1])
    inter_x2 = np.minimum(a[:, None, 2], b[None, :, 2])
    inter_y2 = np.minimum(a[:, None, 3], b[None, :, 3])

    inter_w = np.clip(inter_x2 - inter_x1, 0, None)
    inter_h = np.clip(inter_y2 - inter_y1, 0, None)
    inter = inter_w * inter_h

    area_a = (a[:, 2] - a[:, 0]) * (a[:, 3] - a[:, 1])
    area_b = (b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])

    union = area_a[:, None] + area_b[None, :] - inter + 1e-6
    return inter / union


def _nms(boxes: np.ndarray, scores: np.ndarray, iou_thres: float) -> List[int]:
    order = scores.argsort()[::-1]
    keep: List[int] = []
    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        if order.size == 1:
            break
        ious = _box_iou(boxes[i:i + 1], boxes[order[1:]])[0]
        remaining = np.where(ious <= iou_thres)[0]
        order = order[remaining + 1]
    return keep


def _yolo_vehicle_detections(
    img: np.ndarray,
    session: ort.InferenceSession,
    img_size: int = IMG_SIZE,
    conf_thres: float = CONF_THRES,
    iou_thres: float = IOU_THRES,
) -> List[Dict[str, Any]]:
    h0, w0, _ = img.shape
    img_resized = cv2.resize(img, (img_size, img_size))
    img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
    img_norm = img_rgb.astype(np.float32) / 255.0
    img_chw = np.transpose(img_norm, (2, 0, 1))
    input_tensor = np.expand_dims(img_chw, axis=0).astype(np.float32)

    input_name = session.get_inputs()[0].name
    outputs = session.run(None, {input_name: input_tensor})
    pred = outputs[0]

    if pred.ndim != 3 or pred.shape[0] != 1:
        raise ValueError(f"Unexpected YOLO ONNX output shape: {pred.shape}")

    pred = pred[0]
    if pred.shape[0] < pred.shape[1]:
        pred = pred.T

    num_cols = pred.shape[1]
    if num_cols < 5:
        raise ValueError(f"Unexpected YOLO ONNX columns: {num_cols}")

    boxes_xywh = pred[:, 0:4]
    obj_conf = pred[:, 4]

    if num_cols == 5:
        cls_conf = np.ones_like(obj_conf)
        cls_ids = np.zeros_like(obj_conf, dtype=np.int32)
    else:
        cls_logits = pred[:, 5:]
        if cls_logits.ndim == 1:
            cls_logits = cls_logits[:, None]
        cls_ids = np.argmax(cls_logits, axis=1)
        cls_conf = cls_logits[np.arange(cls_logits.shape[0]), cls_ids]

    scores = obj_conf * cls_conf
    mask = scores >= conf_thres
    boxes_xywh = boxes_xywh[mask]
    scores = scores[mask]
    cls_ids = cls_ids[mask]

    if boxes_xywh.size == 0:
        return []

    cx = boxes_xywh[:, 0]
    cy = boxes_xywh[:, 1]
    w = boxes_xywh[:, 2]
    h = boxes_xywh[:, 3]

    x1 = cx - w / 2
    y1 = cy - h / 2
    x2 = cx + w / 2
    y2 = cy + h / 2

    x1 = np.clip(x1, 0, img_size)
    y1 = np.clip(y1, 0, img_size)
    x2 = np.clip(x2, 0, img_size)
    y2 = np.clip(y2, 0, img_size)

    x1 = x1 / img_size * w0
    x2 = x2 / img_size * w0
    y1 = y1 / img_size * h0
    y2 = y2 / img_size * h0

    boxes = np.stack([x1, y1, x2, y2], axis=1)
    keep = _nms(boxes, scores, iou_thres=iou_thres)

    detections: List[Dict[str, Any]] = []
    for i in keep:
        bx = boxes[i]
        detections.append(
            {
                "bbox_vehicle": {
                    "x1": int(bx[0]),
                    "y1": int(bx[1]),
                    "x2": int(bx[2]),
                    "y2": int(bx[3]),
                },
                "confidence": float(scores[i]),
                "class_id": int(cls_ids[i]),
            }
        )
    return detections


def _dummy_plate_detections(
    img: np.ndarray,
    vehicles: List[Dict[str, Any]],
    roi: Optional[Dict[str, int]] = None,
) -> List[Dict[str, Any]]:
    plates: List[Dict[str, Any]] = []
    for v in vehicles:
        vb = v["bbox_vehicle"]
        x1 = vb["x1"]
        y1 = vb["y1"]
        x2 = vb["x2"]
        y2 = vb["y2"]

        plate_box = {
            "x1": x1 + int(0.1 * (x2 - x1)),
            "y1": y2 - int(0.3 * (y2 - y1)),
            "x2": x2 - int(0.1 * (x2 - x1)),
            "y2": y2 - int(0.1 * (y2 - y1)),
        }

        plates.append(
            {
                "bbox_vehicle": vb,
                "bbox_plate": plate_box,
                "confidence": v["confidence"],
                "plate_text": "DUMMY1234",
            }
        )
    return plates


def _draw_annotations_on_frame(
    annotated: np.ndarray,
    vehicles: List[Dict[str, Any]],
    plates: List[Dict[str, Any]],
    task: str,
) -> np.ndarray:
    # draw vehicle boxes
    for v in vehicles:
        vb = v["bbox_vehicle"]
        cv2.rectangle(annotated, (vb["x1"], vb["y1"]), (vb["x2"], vb["y2"]), (0, 255, 0), 2)
        cv2.putText(annotated, f"{v.get('confidence', 0.0):.2f}", (vb["x1"], max(0, vb["y1"] - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

    if task == "plate_recognition":
        for p in plates:
            pb = p["bbox_plate"]
            cv2.rectangle(annotated, (pb["x1"], pb["y1"]), (pb["x2"], pb["y2"]), (255, 0, 0), 2)
            cv2.putText(annotated, p.get("plate_text", ""), (pb["x1"], max(0, pb["y1"] - 10)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    return annotated


# ----------------- PUBLIC PIPELINES -----------------
def run_image_pipeline(
    image_bytes: bytes,
    task: str,
    roi: Optional[Dict[str, int]] = None,
) -> Dict[str, Any]:
    img = _decode_image(image_bytes)
    img_for_infer = _apply_roi(img, roi)

    vehicles = _yolo_vehicle_detections(img_for_infer, session=vehicle_session, img_size=IMG_SIZE,
                                       conf_thres=CONF_THRES, iou_thres=IOU_THRES)

    plates: List[Dict[str, Any]] = []
    if task == "plate_recognition":
        plates = _dummy_plate_detections(img_for_infer, vehicles, roi=roi)

    annotated = _draw_annotations_on_frame(img_for_infer.copy(), vehicles, plates, task)
    ok, buf = cv2.imencode(".png", annotated)
    if not ok:
        raise ValueError("Failed to encode annotated image")
    annotated_bytes = buf.tobytes()

    filename = f"{task}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S%f')}.png"
    output_path = OUTPUT_DIR / filename
    with open(output_path, "wb") as f:
        f.write(annotated_bytes)

    return {
        "task": task,
        "image_bytes_annotated": annotated_bytes,
        "vehicle_count": len(vehicles),
        "plates": plates,
        "raw_meta": {"vehicles": vehicles, "roi": roi},
        "local_path": str(output_path),
        "plate_count": len(plates),
    }


def run_video_pipeline(
    video_bytes: bytes,
    task: str,
    roi: Optional[Dict[str, int]] = None,
    frame_skip: int = 1,
    downscale_width: Optional[int] = None,
) -> Dict[str, Any]:
    tmp_in = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    tmp_in.write(video_bytes)
    tmp_in.close()
    cap = cv2.VideoCapture(tmp_in.name)
    if not cap.isOpened():
        raise ValueError("Cannot open video")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # downscale for output and inference
    target_w, target_h = width, height
    if downscale_width and downscale_width < width:
        scale = downscale_width / float(width)
        target_w = int(width * scale)
        target_h = int(height * scale)

    out_dir = OUTPUT_DIR / "videos"
    out_dir.mkdir(parents=True, exist_ok=True)

    output_filename = f"{task}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S%f')}.mp4"
    out_path = out_dir / output_filename

    # try avc1 (H264) then fallback to mp4v
    fourcc_try = cv2.VideoWriter_fourcc(*"avc1")
    writer = cv2.VideoWriter(str(out_path), fourcc_try, fps, (target_w, target_h))
    if not writer.isOpened():
        fourcc_fallback = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(out_path), fourcc_fallback, fps, (target_w, target_h))

    frame_idx = 0
    detections_total = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_skip != 0:
            # still write the original frame (or downscaled)
            if (target_w, target_h) != (width, height):
                frame_out = cv2.resize(frame, (target_w, target_h))
            else:
                frame_out = frame
            writer.write(frame_out)
            frame_idx += 1
            continue

        frame_for_infer = _apply_roi(frame, roi)
        if (target_w, target_h) != (width, height):
            frame_for_infer = cv2.resize(frame_for_infer, (target_w, target_h))

        vehicles = _yolo_vehicle_detections(frame_for_infer, session=vehicle_session, conf_thres=CONF_THRES,
                                           img_size=IMG_SIZE, iou_thres=IOU_THRES)
        plates = _dummy_plate_detections(frame_for_infer, vehicles, roi=roi) if task == "plate_recognition" else []

        annotated = _draw_annotations_on_frame(frame_for_infer.copy(), vehicles, plates, task)

        writer.write(annotated)
        detections_total += len(vehicles)
        frame_idx += 1

    cap.release()
    writer.release()
    try:
        os.remove(tmp_in.name)
    except Exception:
        pass

    return {
        "task": task,
        "frames_processed": frame_idx,
        "vehicle_detections": detections_total,
        "output_video_path": str(out_path),
        "output_filename": output_filename,
        "roi": roi,
        "status": "completed",
    }


# ----------------- VIDEO PIPELINE WITH STORAGE & DB -----------------
JOB_TABLE = "video_jobs"
VEHICLE_TABLE = "vehicle_detections"
PLATE_TABLE = "plate_detections"

supabase = getattr(supabase_client, "supabase", None)
if supabase is None:
    raise RuntimeError("Supabase client not available in app.core.supabase_client")


def _attempt_video_writer(target_path: Path, fps: float, size: Tuple[int, int]):
    """
    Try multiple codecs and return (writer, codec_name).
    This avoids failing when H264/OpenH264 is not available on the platform.
    """
    codecs_to_try = [
        ("avc1", "H264/avc1 (preferred)"),
        ("H264", "H264 (alternate)"),
        ("X264", "X264"),
        ("mp4v", "mp4v (MPEG-4)"),
        ("XVID", "XVID"),
        ("MJPG", "MJPG"),
    ]

    for fourcc_str, _desc in codecs_to_try:
        try:
            fourcc = cv2.VideoWriter_fourcc(*fourcc_str)
            writer = cv2.VideoWriter(str(target_path), fourcc, fps, size)
            if writer.isOpened():
                return writer, fourcc_str
        except Exception:
            continue

    # Last resort: try raw .avi with MJPG explicitly
    try:
        fourcc = cv2.VideoWriter_fourcc(*"MJPG")
        writer = cv2.VideoWriter(str(target_path), fourcc, fps, size)
        if writer.isOpened():
            return writer, "MJPG"
    except Exception:
        pass

    raise RuntimeError("No working video writer codec found on this system. Install ffmpeg or OpenH264.")

def phase_progress(phase: str, frame_pct: float = 0):
    mapping = {
        "upload_received": 0,
        "video_precheck": 5,
        "processing": 10 + frame_pct,   # 10 → 80
        "processing_done": 80,
        "reencoding": 90,
        "uploading": 95,
        "completed": 100,
    }
    return mapping.get(phase, 0)

# ---------------- HELPERS ----------------
def _is_cancelled(job_id: str) -> bool:
    res = (
        supabase.table(JOB_TABLE)
        .select("cancelled")
        .eq("id", job_id)
        .single()
        .execute()
    )
    return bool(res.data and res.data.get("cancelled"))

def _update(job_id: str, payload: dict):
    supabase.table(JOB_TABLE).update(payload).eq("id", job_id).execute()

def run_video_pipeline_and_store(
    *,
    job_id: str,
    video_bytes: bytes,
    task: str,
    roi: Optional[Dict[str, int]] = None,
    frame_skip: int = 1,
    downscale_width: int = 1280,
):
    import time

    start_ts = time.time()

    # ----------------- SAVE INPUT VIDEO -----------------
    tmp_in = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    tmp_in.write(video_bytes)
    tmp_in.close()

    cap = cv2.VideoCapture(tmp_in.name)
    if not cap.isOpened():
        raise RuntimeError("Cannot open input video")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

    scale = min(1.0, downscale_width / w)
    tw, th = int(w * scale), int(h * scale)

    out_dir = OUTPUT_DIR / "videos"
    out_dir.mkdir(parents=True, exist_ok=True)

    raw_out = out_dir / f"{job_id}_raw.mp4"
    final_out = out_dir / f"{job_id}.mp4"

    writer, codec = _attempt_video_writer(raw_out, fps, (tw, th))

    # ----------------- DB: START PROCESSING -----------------
    _update(job_id, {
        "status": VIDEO_STATUS["PROCESSING"],
        "progress_percent": 10,
        "processed_frames": 0,
    })

    frame_idx = 0
    vehicle_count = 0
    plate_count = 0
    last_update = time.time()

    # ----------------- FRAME LOOP -----------------
    while True:
        ok, frame = cap.read()
        if not ok:
            break

        if _is_cancelled(job_id):
            cap.release()
            writer.release()
            _update(job_id, {
                "status": VIDEO_STATUS["FAILED"],
                "error": "Cancelled by user",
            })
            return

        if frame_idx % frame_skip != 0:
            writer.write(cv2.resize(frame, (tw, th)))
            frame_idx += 1
            continue

        frame = cv2.resize(frame, (tw, th))
        frame_for_infer = _apply_roi(frame, roi)

        # -------- INFERENCE --------
        vehicles = _yolo_vehicle_detections(
            frame_for_infer,
            session=vehicle_session,
            img_size=IMG_SIZE,
            conf_thres=CONF_THRES,
            iou_thres=IOU_THRES,
        )

        plates = []
        if task == "plate_recognition":
            plates = _dummy_plate_detections(frame_for_infer, vehicles, roi)

        vehicle_count += len(vehicles)
        plate_count += len(plates)

        # -------- DRAW --------
        annotated = _draw_annotations_on_frame(
            frame_for_infer.copy(),
            vehicles,
            plates,
            task,
        )

        writer.write(annotated)
        frame_idx += 1

        # -------- PROGRESS UPDATE (1s throttle) --------
        now = time.time()
        if now - last_update >= 1:
            pct = 10 + (frame_idx / max(total_frames, 1)) * 70
            _update(job_id, {
                "processed_frames": frame_idx,
                "progress_percent": round(min(pct, 80), 2),
            })
            last_update = now

    cap.release()
    writer.release()

    # ----------------- RE-ENCODE -----------------
    _update(job_id, {"status": VIDEO_STATUS["REENCODING"], "progress_percent": 90})

    try:
        reencode_ffmpeg(
            src_path=str(raw_out),
            dst_path=str(final_out),
            crf=24,
            max_width=downscale_width,
            fps=int(fps),
        )
        upload_path = final_out
    except Exception as e:
        logger.warning("Re-encode failed, using raw output: %s", e)
        upload_path = raw_out

    # ----------------- UPLOAD -----------------
    _update(job_id, {"status": "uploading", "progress_percent": 95})

    video_url = None
    upload_error = None

    from app.services.storage import upload_bytes_to_video_bucket

    storage_key = f"videos/{uuid.uuid4().hex}.mp4"

    try:
        upload = upload_bytes_to_video_bucket(
            storage_key,
            upload_path.read_bytes(),
        )

        if isinstance(upload, dict):
            video_url = (
                upload.get("public_url")
                or upload.get("publicURL")
                or upload.get("url")
            )

    except Exception as e:
        upload_error = str(e)
        logger.exception("Upload failed job_id=%s", job_id)

    # ----------------- FINALIZE (ONE PATH ONLY) -----------------
    if not video_url:
        _update(job_id, {
            "status": "failed",
            "error": upload_error or "Upload completed but URL missing",
            "progress_percent": 100,
        })
        return

    elapsed = round(time.time() - start_ts, 2)

    _update(job_id, {
        "status": "completed",          # EXACT string UI expects
        "video_url": video_url,
        "progress_percent": 100,
        "frames_processed": frame_idx,
        "vehicle_count": vehicle_count,
        "plate_count": plate_count,
        "processing_time_sec": elapsed,
    })

    return {
        "job_id": job_id,
        "video_url": video_url,
        "frames_processed": frame_idx,
        "vehicle_count": vehicle_count,
        "plate_count": plate_count,
        "processing_time_sec": elapsed,
    }



def run_stream_pipeline(
    stream_url: str,
    task: str,
    roi: Optional[Dict[str, int]] = None,
    frame_skip: int = 1,
    max_frames: Optional[int] = 300,
    duration_sec: Optional[int] = 30,
    preview_save: bool = True,
) -> Dict[str, Any]:
    """
    Lightweight stream/RTSP pipeline.

    - stream_url: RTSP/HTTP/0 for webcam (0 -> int(0))
    - frame_skip: process every N-th frame
    - max_frames: stop after this many processed frames (None -> unlimited)
    - duration_sec: stop after this wall-clock seconds (None -> unlimited)
    - preview_save: save a short annotated preview image to outputs for debugging

    Returns:
      {
        "task": str,
        "status": "completed" | "error",
        "frames_seen": int,
        "frames_processed": int,
        "vehicle_detections": int,
        "plate_detections": int,
        "preview_path": str|None,
        "error": str|None
      }
    """
    import time

    # allow numeric camera index
    source = stream_url
    try:
        if isinstance(stream_url, str) and stream_url.isdigit():
            source = int(stream_url)
    except Exception:
        source = stream_url

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        return {"task": task, "status": "error", "error": "Failed to open stream", "frames_seen": 0}

    _update(job_id, {
        "status": VIDEO_STATUS["PROCESSING"],
        "progress_percent": 5,
        "processed_frames": 0,
    })

    start_time = time.time()
    frames_seen = 0
    frames_processed = 0
    total_vehicles = 0
    total_plates = 0
    sample_detections: List[Dict[str, Any]] = []

    preview_img = None

    while True:
        ret, frame = cap.read()
        if not ret:
            # if intermittent failure, wait briefly then try again until timeout
            if (time.time() - start_time) > (duration_sec or 30):
                break
            time.sleep(0.1)
            continue

        frames_seen += 1

        # stop by duration
        if duration_sec and (time.time() - start_time) > duration_sec:
            break

        # optional limit by processed frames
        if max_frames and frames_processed >= max_frames:
            break

        if (frames_seen - 1) % frame_skip != 0:
            continue

        # apply ROI, detect
        frame_for_infer = _apply_roi(frame, roi)
        try:
            vehicles = _yolo_vehicle_detections(
                frame_for_infer,
                session=vehicle_session,
                img_size=IMG_SIZE,
                conf_thres=CONF_THRES,
                iou_thres=IOU_THRES,
            )
        except Exception as e:
            # log and continue
            logging.getLogger(__name__).exception("Stream inference error: %s", e)
            vehicles = []

        plates = []
        if task == "plate_recognition":
            plates = _dummy_plate_detections(frame_for_infer, vehicles, roi=roi)

        total_vehicles += len(vehicles)
        total_plates += len(plates)
        frames_processed += 1

        # collect a small sample of detections for immediate UI feedback (limit to 50)
        if len(sample_detections) < 50:
            for v in vehicles:
                sample_detections.append({"frame": frames_seen, "bbox": v["bbox_vehicle"], "confidence": v["confidence"]})

        # build preview image (first processed frame) for debugging if requested
        if preview_save and preview_img is None:
            try:
                annotated = _draw_annotations(frame_for_infer, vehicles, plates, task)
                preview_bytes = annotated  # PNG bytes returned by helper
                preview_filename = f"stream_preview_{datetime.utcnow().strftime('%Y%m%d_%H%M%S%f')}.png"
                preview_path = OUTPUT_DIR / preview_filename
                with open(preview_path, "wb") as fh:
                    fh.write(preview_bytes)
                preview_img = str(preview_path)
            except Exception:
                preview_img = None

    cap.release()

    return {
        "task": task,
        "status": "completed",
        "frames_seen": frames_seen,
        "frames_processed": frames_processed,
        "vehicle_detections": total_vehicles,
        "plate_detections": total_plates,
        "sample_detections": sample_detections,
        "preview_path": preview_img,
    }
