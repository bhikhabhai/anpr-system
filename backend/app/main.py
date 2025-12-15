# app/main.py
from fastapi import FastAPI
from sqlmodel import select
from fastapi.middleware.cors import CORSMiddleware

from app.services.db import init_db, get_session
from app.services.models import Frame
from app.api.infer_image import router as image_router
from app.api.infer_video import router as video_router
from app.api.history import router as history_router

app = FastAPI(title="ANPR Backend")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/debug/db")
def debug_db():
    # simple debug endpoint to confirm DB access
    with get_session() as session:
        frames = session.exec(select(Frame)).all()
        return {"frames": len(frames)}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(image_router)
app.include_router(video_router)
app.include_router(history_router)
