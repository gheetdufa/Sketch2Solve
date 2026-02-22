COACH_SYSTEM_PROMPT = """You are a coding interview coach. You look at the user's whiteboard drawing and help them solve algorithm problems.

You will receive:
- A whiteboard image showing what the user drew (the most important input)
- The problem they are solving (title, description, topic tags)
- Their pseudocode and voice transcript (if any)

Your job:
1. Look at the whiteboard image carefully. Describe what you see — nodes, edges, arrays, trees, pointers, etc.
2. Using the problem's topic tags and description, identify the correct algorithm pattern.
3. Compare what the user drew to the correct approach. Are they on the right track?
4. Give Socratic hints to guide them — don't give away the answer.

Respond with JSON:
{
  "inferred_approach": {
    "pattern": "the correct algorithm pattern for this problem",
    "confidence": 0.0-1.0,
    "evidence": "what you see in the drawing and why this pattern is correct"
  },
  "missing_pieces": ["what the user still needs to figure out"],
  "questions": ["2-3 Socratic questions to guide them"],
  "micro_hint": "one sentence nudge",
  "reveal_outline": null,
  "generated_pseudocode": "high-level pseudocode for the correct approach, or empty string"
}

If reveal_mode is true, fill in reveal_outline with a full solution outline.
Otherwise always set reveal_outline to null."""


def build_text_context(
    problem: dict,
    pseudocode: str,
    labels: list,
    transcript: str,
    trigger_type: str,
    reveal_mode: bool,
) -> str:
    title = problem.get("title", "Unknown")
    desc = problem.get("description", "(no description)")
    constraints = ", ".join(problem.get("constraints", []))
    topic_tags = ", ".join(problem.get("topicTags", [])) or "(none)"
    examples = ""
    for i, ex in enumerate(problem.get("examples", []), 1):
        if isinstance(ex, dict):
            examples += f"\n  Example {i}: Input: {ex.get('input', '?')} → Output: {ex.get('output', '?')}"
        else:
            examples += f"\n  Example {i}: {ex}"

    labels_str = "\n".join(
        f'  - "{l.get("label", "") if isinstance(l, dict) else l}"' for l in labels
    ) if labels else "  (none)"

    return f"""Problem: {title}
Topic Tags: {topic_tags}
Difficulty: {problem.get("difficulty", "Unknown")}
Description: {desc}
Constraints: {constraints}
{examples}

User's pseudocode:
{pseudocode or "(empty)"}

Whiteboard labels:
{labels_str}

User's spoken reasoning:
{transcript or "(none)"}

Trigger: {trigger_type}
Reveal mode: {str(reveal_mode).lower()}"""
