import io
import os
from openai import AsyncOpenAI
from backend.core.ws import ws_manager
from datetime import datetime, timezone

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


async def transcribe_audio(audio_bytes: bytes, session_id: str, db_session, checkpoint_id: str):
    """Background task: transcribe audio via Whisper, update DB and push via WS."""
    try:
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "chunk.webm"
        response = await _get_client().audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
        )
        transcript_delta = response.text.strip()
        if not transcript_delta:
            return

        from backend.models.db import Checkpoint, Session as DBSession
        checkpoint = db_session.query(Checkpoint).filter_by(id=checkpoint_id).first()
        if checkpoint:
            checkpoint.transcript_delta = transcript_delta

        session = db_session.query(DBSession).filter_by(id=session_id).first()
        if session:
            sep = "\n" if session.full_transcript else ""
            session.full_transcript = (session.full_transcript or "") + sep + transcript_delta

        db_session.commit()

        await ws_manager.broadcast(session_id, {
            "type": "transcript_delta",
            "text": transcript_delta,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        print(f"[STT] Transcription error: {e}")
