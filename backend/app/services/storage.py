from __future__ import annotations

import io
import logging
import uuid
from pathlib import Path
from typing import Optional, Dict, Any

from app.core import supabase_client
from app.core.config import settings

logger = logging.getLogger(__name__)
supabase = getattr(supabase_client, "supabase", None)

if supabase is None:
    # try alternative export names
    supabase = getattr(supabase_client, "client", None)

if supabase is None:
    raise RuntimeError("Supabase client not found in app.core.supabase_client. Export 'supabase' (service client) from that module.")

# default buckets from settings
DEFAULT_IMAGE_BUCKET = settings.SUPABASE_STORAGE_BUCKET
DEFAULT_VIDEO_BUCKET = settings.SUPABASE_VIDEO_BUCKET
DEFAULT_CROPS_BUCKET = settings.SUPABASE_CROPS_BUCKET


def _storage_obj():
    """
    Normalize access to storage object across client versions.
    """
    # some clients expose supabase.storage() (callable) or supabase.storage (property)
    storage = None
    try:
        storage = supabase.storage() if callable(getattr(supabase, "storage", None)) else supabase.storage
    except Exception:
        storage = getattr(supabase, "storage", None)

    if storage is None:
        raise RuntimeError("Unable to get storage object from supabase client.")
    return storage


def _bucket_accessor(bucket_name: str):
    storage = _storage_obj()
    # Try common methods to access bucket
    for accessor in ("from_", "from_bucket", "bucket", "from"):
        try:
            fn = getattr(storage, accessor)
            return fn(bucket_name)
        except Exception:
            continue
    raise RuntimeError("Unsupported supabase.storage client interface; check app.core.supabase_client.py")


def _get_public_url_from_accessor(bucket_accessor, dest_path: str) -> Optional[str]:
    # try common public url getters
    try:
        fn = getattr(bucket_accessor, "get_public_url", None)
        if callable(fn):
            out = fn(dest_path)
            if isinstance(out, dict):
                return out.get("publicURL") or out.get("public_url") or out.get("url")
            if isinstance(out, str):
                return out
    except Exception:
        pass

    # try create_signed_url if available on accessor
    try:
        fn2 = getattr(bucket_accessor, "create_signed_url", None)
        if callable(fn2):
            out = fn2(dest_path, expires_in=60 * 60 * 24 * 7)
            if isinstance(out, dict):
                return out.get("signedURL") or out.get("signed_url") or out.get("url")
            if isinstance(out, str):
                return out
    except Exception:
        pass

    return None


def _upload_to_bucket(bucket_name: str, dest_path: str, data: bytes) -> Dict[str, Any]:
    """
    Upload bytes to bucket and return structure:
      {"path": dest_path, "public_url": ..., "raw_response": ...}
    """
    bucket = _bucket_accessor(bucket_name)
    raw_resp = None
    # Try file-like upload first, then raw bytes
    try:
        try:
            raw_resp = bucket.upload(dest_path, io.BytesIO(data))
        except TypeError:
            # some clients expect raw bytes
            raw_resp = bucket.upload(dest_path, data)
    except Exception as exc:
        # fallback to storage.from_(bucket).upload style if available on supabase object
        try:
            storage = _storage_obj()
            raw_resp = storage.from_(bucket_name).upload(dest_path, data)
        except Exception as exc2:
            logger.exception("Upload failed to %s/%s: %s ; fallback error: %s", bucket_name, dest_path, exc, exc2)
            raise

    public_url = _get_public_url_from_accessor(bucket, dest_path)
    return {"path": dest_path, "public_url": public_url, "raw_response": raw_resp}


# Backwards-compatible helpers the rest of your code expects
def upload_bytes_to_video_bucket(dest_path: str, file_bytes: bytes) -> Dict[str, Any]:
    return _upload_to_bucket(DEFAULT_VIDEO_BUCKET, dest_path, file_bytes)


def upload_bytes_to_crops_bucket(dest_path: str, file_bytes: bytes) -> Dict[str, Any]:
    return _upload_to_bucket(DEFAULT_CROPS_BUCKET, dest_path, file_bytes)


def upload_bytes_to_image_bucket(dest_path: str, file_bytes: bytes) -> Dict[str, Any]:
    return _upload_to_bucket(DEFAULT_IMAGE_BUCKET, dest_path, file_bytes)


def upload_local_file_to_bucket(bucket_name: str, dest_path: str, local_path: Path) -> Dict[str, Any]:
    data = local_path.read_bytes()
    return _upload_to_bucket(bucket_name, dest_path, data)

def upload_bytes_to_video_bucket(dest_path: str, file_bytes: bytes) -> Dict[str, Any]:
    return _upload_to_bucket(DEFAULT_VIDEO_BUCKET, dest_path, file_bytes)


def upload_frame(image_bytes: bytes, ext: str = "png", bucket_name: Optional[str] = None) -> Optional[str]:
    """
    Backwards-compatible frame upload: returns public URL (or None)
    """
    bucket = bucket_name or DEFAULT_IMAGE_BUCKET
    file_id = uuid.uuid4().hex
    file_name = f"{file_id}.{ext}"
    file_path = f"frames/{file_name}"
    res = _upload_to_bucket(bucket, file_path, image_bytes)
    public = res.get("public_url") or None
    if not public:
        logger.debug("Upload returned no public_url for %s/%s. raw_response=%s", bucket, file_path, res.get("raw_response"))
    return public
