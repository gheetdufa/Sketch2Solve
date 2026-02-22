import base64
import io
import json
import os
from openai import AsyncOpenAI
from backend.services.storage import save_file
from backend.services.tts import synthesize_hint
from backend.prompts.coach_brain import COACH_SYSTEM_PROMPT, build_text_context
from backend.core.ws import ws_manager
from backend.models.db import Session as DBSession, Checkpoint, Analysis, generate_uuid

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client

FALLBACK_RESPONSE = {
    "inferred_approach": {"pattern": "Unknown", "confidence": 0.0, "evidence": "Analysis unavailable"},
    "missing_pieces": ["Unable to analyze at this time"],
    "questions": ["Can you describe your current approach in words?"],
    "micro_hint": "Try restating the problem constraints aloud.",
    "reveal_outline": None,
}


async def run_coach(
    session_id: str,
    trigger_type: str,
    audio_bytes: bytes | None,
    png_bytes: bytes | None,
    reveal_mode: bool,
    db,
):
    session = db.query(DBSession).filter_by(id=session_id).first()
    if not session:
        return FALLBACK_RESPONSE

    analysis_id = generate_uuid()
    snapshot_url = None
    if png_bytes:
        snapshot_url = await save_file(session_id, f"snap_{analysis_id}.png", png_bytes)

    # Gather context from DB
    latest_cp = (
        db.query(Checkpoint)
        .filter_by(session_id=session_id)
        .order_by(Checkpoint.sequence_num.desc())
        .first()
    )

    pseudocode = latest_cp.pseudocode if latest_cp else ""
    labels = latest_cp.labels if latest_cp else []
    transcript = session.full_transcript or ""
    problem = session.problem_json or {}

    text_context = build_text_context(
        problem=problem,
        pseudocode=pseudocode,
        labels=labels,
        transcript=transcript,
        trigger_type=trigger_type,
        reveal_mode=reveal_mode,
    )

    # Transcribe audio if present
    if audio_bytes and len(audio_bytes) > 1000:
        try:
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = "audio.webm"
            whisper_resp = await _get_client().audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
            )
            audio_transcript = whisper_resp.text or ""
            if audio_transcript:
                text_context += f"\n\nUser just said: {audio_transcript}"
        except Exception as e:
            print(f"[Coach] Whisper transcription error: {e}")

    # Build message: text + image (just like pasting into a chat app)
    user_content = [{"type": "text", "text": text_context}]
    if png_bytes:
        b64 = base64.b64encode(png_bytes).decode("utf-8")
        user_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{b64}"},
        })

    try:
        response = await _get_client().chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": COACH_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        result = json.loads(raw)
    except Exception as e:
        print(f"[Coach] LLM error: {e}")
        result = FALLBACK_RESPONSE
        raw = json.dumps(FALLBACK_RESPONSE)

    approach = result.get("inferred_approach", {})
    visual_description = approach.get("evidence", "")

    analysis = Analysis(
        id=analysis_id,
        session_id=session_id,
        checkpoint_id=latest_cp.id if latest_cp else None,
        trigger_type=trigger_type,
        inferred_pattern=approach.get("pattern", ""),
        confidence=approach.get("confidence", 0.0),
        evidence=approach.get("evidence", ""),
        visual_description=visual_description,
        snapshot_url=snapshot_url,
        missing_pieces=result.get("missing_pieces", []),
        questions=result.get("questions", []),
        micro_hint=result.get("micro_hint", ""),
        reveal_outline=result.get("reveal_outline"),
        raw_llm_response=raw,
    )
    db.add(analysis)
    db.commit()

    # Optional TTS for the micro-hint
    hint_audio_url = None
    micro_hint = result.get("micro_hint", "")
    if micro_hint:
        tts_bytes = await synthesize_hint(micro_hint)
        if tts_bytes:
            hint_audio_url = await save_file(session_id, f"hint_{analysis_id}.mp3", tts_bytes)

    coach_response = {
        "analysis_id": analysis.id,
        "inferred_approach": approach,
        "visual_description": visual_description,
        "generated_pseudocode": result.get("generated_pseudocode", ""),
        "missing_pieces": result.get("missing_pieces", []),
        "questions": result.get("questions", []),
        "micro_hint": micro_hint,
        "reveal_outline": result.get("reveal_outline"),
        "hint_audio_url": hint_audio_url,
    }

    await ws_manager.broadcast(session_id, {
        "type": "coach_response",
        "analysis": coach_response,
    })

    return coach_response
