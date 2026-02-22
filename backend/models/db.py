import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Float, Integer, JSON, Enum, ForeignKey, DateTime, create_engine
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    lc_id = Column(String, nullable=True)
    problem_json = Column(JSON, nullable=True)
    full_transcript = Column(Text, default="")
    status = Column(String, default="active")  # active | completed
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    checkpoints = relationship("Checkpoint", back_populates="session", order_by="Checkpoint.sequence_num")
    analyses = relationship("Analysis", back_populates="session", order_by="Analysis.created_at")
    mental_model_card = relationship("MentalModelCard", back_populates="session", uselist=False)


class Checkpoint(Base):
    __tablename__ = "checkpoints"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    sequence_num = Column(Integer, nullable=False)
    pseudocode = Column(Text, default="")
    whiteboard_json = Column(Text, default="{}")
    labels = Column(JSON, default=list)
    audio_url = Column(String, nullable=True)
    transcript_delta = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    session = relationship("Session", back_populates="checkpoints")


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    checkpoint_id = Column(String, ForeignKey("checkpoints.id"), nullable=True)
    trigger_type = Column(String, nullable=False)
    inferred_pattern = Column(String, default="")
    confidence = Column(Float, default=0.0)
    evidence = Column(Text, default="")
    visual_description = Column(Text, default="")
    snapshot_url = Column(String, nullable=True)
    missing_pieces = Column(JSON, default=list)
    questions = Column(JSON, default=list)
    micro_hint = Column(Text, default="")
    reveal_outline = Column(Text, nullable=True)
    raw_llm_response = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow)

    session = relationship("Session", back_populates="analyses")


class MentalModelCard(Base):
    __tablename__ = "mental_model_cards"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("sessions.id"), unique=True, nullable=False)
    final_pattern = Column(String, default="")
    key_invariants = Column(JSON, default=list)
    approach_evolution = Column(JSON, default=list)
    unanswered_questions = Column(JSON, default=list)
    full_transcript = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow)

    session = relationship("Session", back_populates="mental_model_card")


DATABASE_URL = "sqlite:///./sketch2solve.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
