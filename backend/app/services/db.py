# app/services/db.py
from sqlmodel import SQLModel, Session, create_engine

from app.core.config import settings

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL not configured")

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)


def init_db() -> None:
    # Import models so metadata is registered
    from app.services import models  # noqa: F401
    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    return Session(engine)
