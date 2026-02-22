from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session as DBSessionType

from backend.models.db import get_db, Session as DBSession
from backend.services.verifier import verify_code

router = APIRouter(tags=["verify"])


class VerifyRequest(BaseModel):
    session_id: str
    code: str
    language: str
    problem_title: Optional[str] = ""


@router.post("/verify")
async def verify(body: VerifyRequest, db: DBSessionType = Depends(get_db)):
    session = db.query(DBSession).filter_by(id=body.session_id).first()
    problem = session.problem_json if session else {}

    result = await verify_code(
        code=body.code,
        language=body.language,
        problem=problem,
        problem_title=body.problem_title,
    )
    return result
