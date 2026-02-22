from fastapi import APIRouter, Depends, UploadFile, File, Form
from typing import Optional
from sqlalchemy.orm import Session as DBSessionType

from backend.models.db import get_db
from backend.services.coach import run_coach

router = APIRouter(tags=["coach"])


@router.post("/sessions/{session_id}/coach")
async def trigger_coach(
    session_id: str,
    trigger_type: str = Form(...),
    reveal_mode: bool = Form(False),
    audio_blob: Optional[UploadFile] = File(None),
    whiteboard_png: Optional[UploadFile] = File(None),
    db: DBSessionType = Depends(get_db),
):
    audio_bytes = None
    if audio_blob and audio_blob.size and audio_blob.size > 0:
        audio_bytes = await audio_blob.read()

    png_bytes = None
    if whiteboard_png and whiteboard_png.size and whiteboard_png.size > 0:
        png_bytes = await whiteboard_png.read()

    result = await run_coach(
        session_id=session_id,
        trigger_type=trigger_type,
        audio_bytes=audio_bytes,
        png_bytes=png_bytes,
        reveal_mode=reveal_mode,
        db=db,
    )
    return result
