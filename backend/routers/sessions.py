from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session as DBSessionType

from backend.models.db import get_db, Session as DBSession, MentalModelCard, generate_uuid
from backend.services.problems import resolve_problem

router = APIRouter(prefix="/sessions", tags=["sessions"])


class CreateSessionRequest(BaseModel):
    lc_id: Optional[str] = None
    problem_text: Optional[str] = None


class SetProblemRequest(BaseModel):
    lc_id: Optional[str] = None
    problem_text: Optional[str] = None


@router.post("")
async def create_session(body: CreateSessionRequest, db: DBSessionType = Depends(get_db)):
    problem = await resolve_problem(body.lc_id, body.problem_text)
    needs_manual_input = problem is None and not body.problem_text

    session = DBSession(
        lc_id=body.lc_id,
        problem_json=problem,
        status="active",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "problem": problem,
        "needs_manual_input": needs_manual_input,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


@router.patch("/{session_id}/problem")
async def set_problem(session_id: str, body: SetProblemRequest, db: DBSessionType = Depends(get_db)):
    session = db.query(DBSession).filter_by(id=session_id).first()
    if not session:
        return {"error": "Session not found"}, 404

    problem = await resolve_problem(body.lc_id, body.problem_text)
    if problem:
        session.problem_json = problem
        session.lc_id = body.lc_id
        db.commit()
        return {"problem": problem, "needs_manual_input": False}
    return {"problem": None, "needs_manual_input": True}


@router.get("/{session_id}")
def get_session(session_id: str, db: DBSessionType = Depends(get_db)):
    session = db.query(DBSession).filter_by(id=session_id).first()
    if not session:
        return {"error": "Session not found"}, 404
    return {
        "session_id": session.id,
        "problem": session.problem_json,
        "status": session.status,
        "full_transcript": session.full_transcript,
        "checkpoint_count": len(session.checkpoints),
        "analysis_count": len(session.analyses),
    }


@router.post("/{session_id}/complete")
def complete_session(session_id: str, db: DBSessionType = Depends(get_db)):
    session = db.query(DBSession).filter_by(id=session_id).first()
    if not session:
        return {"error": "Session not found"}, 404

    session.status = "completed"

    evolution = []
    for a in session.analyses:
        evolution.append({
            "sequence_num": a.checkpoint_id,
            "pattern": a.inferred_pattern,
            "confidence": a.confidence,
        })

    last = session.analyses[-1] if session.analyses else None
    card = MentalModelCard(
        session_id=session_id,
        final_pattern=last.inferred_pattern if last else "",
        key_invariants=[p for p in (last.missing_pieces if last else [])],
        approach_evolution=evolution,
        unanswered_questions=last.questions if last else [],
        full_transcript=session.full_transcript or "",
    )
    db.add(card)
    db.commit()
    db.refresh(card)

    return {"session_id": session_id, "mental_model_card_id": card.id}


@router.get("/{session_id}/card")
def get_card(session_id: str, db: DBSessionType = Depends(get_db)):
    card = db.query(MentalModelCard).filter_by(session_id=session_id).first()
    if not card:
        return {"error": "Card not found"}, 404
    return {
        "id": card.id,
        "session_id": card.session_id,
        "final_pattern": card.final_pattern,
        "key_invariants": card.key_invariants,
        "approach_evolution": card.approach_evolution,
        "unanswered_questions": card.unanswered_questions,
        "full_transcript": card.full_transcript,
        "created_at": card.created_at.isoformat() if card.created_at else None,
    }
