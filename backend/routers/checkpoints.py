import asyncio
import json
from fastapi import APIRouter, Depends, UploadFile, File, Form
from typing import Optional
from sqlalchemy.orm import Session as DBSessionType

from backend.models.db import get_db, Checkpoint, SessionLocal
from backend.services.storage import save_file
from backend.services.stt import transcribe_audio
from backend.core.ws import ws_manager

router = APIRouter(prefix="/checkpoints", tags=["checkpoints"])


@router.post("")
async def create_checkpoint(
    session_id: str = Form(...),
    sequence_num: int = Form(...),
    pseudocode: str = Form(""),
    whiteboard_json: str = Form("{}"),
    labels: str = Form("[]"),
    audio_blob: Optional[UploadFile] = File(None),
    db: DBSessionType = Depends(get_db),
):
    parsed_labels = []
    try:
        parsed_labels = json.loads(labels)
    except (json.JSONDecodeError, TypeError):
        pass

    audio_url = None
    audio_bytes = None
    if audio_blob and audio_blob.size and audio_blob.size > 0:
        audio_bytes = await audio_blob.read()
        audio_url = await save_file(session_id, f"audio_{sequence_num}.webm", audio_bytes)

    cp = Checkpoint(
        session_id=session_id,
        sequence_num=sequence_num,
        pseudocode=pseudocode,
        whiteboard_json=whiteboard_json,
        labels=parsed_labels,
        audio_url=audio_url,
    )
    db.add(cp)
    db.commit()
    db.refresh(cp)

    if audio_bytes:
        bg_db = SessionLocal()
        asyncio.create_task(_run_stt(audio_bytes, session_id, bg_db, cp.id))

    await ws_manager.broadcast(session_id, {
        "type": "checkpoint_saved",
        "checkpoint_id": cp.id,
    })

    return {
        "checkpoint_id": cp.id,
        "audio_url": audio_url,
        "transcript_delta": None,
    }


async def _run_stt(audio_bytes: bytes, session_id: str, db, checkpoint_id: str):
    try:
        await transcribe_audio(audio_bytes, session_id, db, checkpoint_id)
    finally:
        db.close()
