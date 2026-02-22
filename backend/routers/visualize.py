from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from backend.services.visualizer import pseudocode_to_shapes

router = APIRouter(tags=["visualize"])


class VisualizeRequest(BaseModel):
    pseudocode: str
    problem_title: Optional[str] = ""


@router.post("/visualize")
async def visualize(body: VisualizeRequest):
    shapes = await pseudocode_to_shapes(body.pseudocode, body.problem_title or "")
    return {"shapes": shapes}
