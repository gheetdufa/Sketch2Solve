import json
import os
from openai import AsyncOpenAI

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


SYSTEM_PROMPT = """You are a visualization engine that converts pseudocode into a diagram that
FAITHFULLY represents the data structures and operations described in the pseudocode.

CRITICAL RULE: Your diagram must match the pseudocode EXACTLY.
- If the pseudocode builds a graph → draw graph nodes and edges.
- If the pseudocode uses a stack → draw a stack.
- If the pseudocode does BFS with a queue → draw a queue feeding into visited nodes.
- If the pseudocode uses a hashmap → draw key-value boxes.
- NEVER substitute one data structure for another. If the user wrote "graph", do NOT draw a hashmap.

Given pseudocode (and optionally a problem title), produce a JSON object {"shapes": [...]} where
each shape is one of:

1. {"type":"box","id":"unique_id","x":number,"y":number,"w":number,"h":number,"label":"text","color":"violet|green|red|yellow"}
   - Use to represent: data structure elements (graph nodes, array cells, tree nodes, stack frames, queue entries),
     operations, conditions, function blocks.
2. {"type":"text","id":"unique_id","x":number,"y":number,"label":"text"}
   - Use for: titles, annotations, variable names, complexity notes.
3. {"type":"arrow","id":"unique_id","from":"source_box_id","to":"target_box_id","label":"optional_label"}
   - Use for: edges in a graph, pointers, data flow, traversal order.

Layout rules:
- Start at x=0, y=0. Flow top-to-bottom or left-to-right.
- Use ~160px horizontal spacing and ~90px vertical spacing between boxes.
- Standard box size: w=140, h=50.
- Colors: "green" for input/start, "red" for termination/return, "yellow" for conditions/decisions, "violet" for processing/operations.
- Keep labels concise (under 30 chars).
- Maximum 12 shapes. Focus on the core algorithmic structure from the pseudocode.

Visualization strategies per data structure:
- Graph: show nodes as boxes arranged in a network, arrows as edges. Label with node values.
- Tree: show hierarchical boxes with parent→child arrows.
- Array: show boxes in a horizontal row, label with indices or values.
- Stack/Queue: show boxes stacked vertically (stack) or horizontally (queue).
- HashMap: show key→value pairs as connected box pairs.
- Two pointers: show array with arrow annotations for left/right pointers.

Return ONLY valid JSON {"shapes": [...]}. No markdown fences, no explanation."""


async def pseudocode_to_shapes(pseudocode: str, problem_title: str = "") -> list[dict]:
    if len(pseudocode.strip()) < 10:
        return []

    context = pseudocode
    if problem_title:
        context = f"Problem: {problem_title}\n\n{pseudocode}"

    try:
        response = await _get_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": context},
            ],
            max_tokens=800,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "[]"
        parsed = json.loads(raw)

        if isinstance(parsed, dict):
            parsed = parsed.get("shapes", parsed.get("diagram", []))
        if not isinstance(parsed, list):
            return []

        valid = []
        for s in parsed:
            if not isinstance(s, dict) or "type" not in s:
                continue
            if s["type"] in ("box", "text", "arrow"):
                valid.append(s)
        return valid[:12]

    except Exception as e:
        print(f"[Visualizer] Error: {e}")
        return []
