import base64
import json
import os
from openai import AsyncOpenAI

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client

VISION_PROMPT = """This is a screenshot of a user's whiteboard while they solve an algorithm problem.
The drawing is FREEHAND / SKETCH style — expect imperfect lines, rough shapes, and handwritten text.

Your job is to PRECISELY describe what is actually drawn. Do NOT guess or assume intent beyond what is visible.

IMPORTANT — interpreting freehand sketches:
- Rough circles or ovals = nodes. Rough rectangles = boxes or array cells.
- Wavy or jagged lines connecting shapes = edges or arrows (check for arrowheads to determine direction).
- Handwritten text near or inside shapes = labels. Read carefully — handwriting may be messy.
- A row of adjacent boxes/cells = array. Stacked boxes = stack. Circles connected by lines = graph or tree.
- Small marks like "i", "j", "L", "R", or carets (^) near array cells = pointer annotations.
- If shapes are ambiguous, describe what you literally see (e.g., "rough oval") rather than guessing.

Return a JSON object with exactly two fields:

1. "visual_description": 3-5 sentences describing EXACTLY what you see:
   - What shapes are drawn (boxes, circles, nodes, lines, arrows)?
   - What text labels or annotations are written? Transcribe ALL visible text.
   - What data structures are depicted (array, linked list, tree, graph, matrix, stack, queue, etc.)?
   - What transformations or flows do the arrows indicate?
   - Be LITERAL: if you see nodes connected by edges, say "graph with N nodes and M edges", not "hashmap".
     If you see boxes with arrows between them, describe the boxes and where arrows point.
     If you see an array with an arrow to a tree, say "array being converted to a tree".
   - Do NOT project patterns onto the drawing. Describe structure, not intent.

2. "generated_pseudocode": Translate ONLY what is visually depicted into pseudocode.
   - If the drawing shows a graph with nodes and edges, write graph construction code.
   - If the drawing shows a tree traversal with arrows, write the traversal.
   - If the drawing shows an array with two pointers, write a two-pointer loop.
   - Match the pseudocode to the ACTUAL data structures visible in the drawing.
   - Do NOT default to hashmaps or arrays unless those are clearly what's drawn.
   - Keep it concise (5-15 lines). Use plain pseudocode, not any specific language.
   - If the whiteboard is empty or has no algorithmic content, set this to empty string.

CRITICAL: Your description must be an accurate mirror of the drawing. A colleague looking at your
description should be able to reconstruct what was drawn without seeing the image.

Return ONLY valid JSON, no markdown fences."""


async def describe_whiteboard(png_bytes: bytes) -> dict:
    """Vision pre-pass: send whiteboard PNG to GPT-4o, return {visual_description, generated_pseudocode}."""
    try:
        b64 = base64.b64encode(png_bytes).decode("utf-8")
        response = await _get_client().chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": VISION_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                ],
            }],
            max_tokens=800,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        result = json.loads(raw)
        return {
            "visual_description": result.get("visual_description", ""),
            "generated_pseudocode": result.get("generated_pseudocode", ""),
        }
    except Exception as e:
        print(f"[Vision] Pre-pass error: {e}")
        return {
            "visual_description": "(vision pre-pass unavailable)",
            "generated_pseudocode": "",
        }
