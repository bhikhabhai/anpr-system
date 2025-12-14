# app/core/config.py
import os
from dataclasses import dataclass
from dotenv import load_dotenv

# Load .env once
load_dotenv()


@dataclass
class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_STORAGE_BUCKET: str = os.getenv("SUPABASE_STORAGE_BUCKET", "anpr-frames")
    SUPABASE_VIDEO_BUCKET: str = os.getenv("SUPABASE_VIDEO_BUCKET", "anpr-video")
    SUPABASE_CROPS_BUCKET: str = os.getenv("SUPABASE_CROPS_BUCKET", "anpr-crop")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")


settings = Settings()