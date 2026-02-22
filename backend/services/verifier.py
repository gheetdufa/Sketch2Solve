import json
import os
from openai import AsyncOpenAI

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


VERIFY_PROMPT = """You are a code verification engine for LeetCode-style problems.
You will receive a problem description and a user's code solution.

Your job:
1. Mentally trace the code against the provided examples/test cases.
2. Generate 3-5 test cases (including edge cases) and evaluate the code against each.
3. Determine if the solution is correct, has bugs, or has the wrong approach.

Return ONLY valid JSON:
{
  "status": "pass" | "fail" | "error",
  "summary": "one-sentence summary of result",
  "results": [
    {
      "passed": true/false,
      "input": "description of input",
      "expected": "expected output",
      "actual": "what the code would produce",
      "error": null or "error description"
    }
  ],
  "feedback": "2-3 sentences: what's correct, what's wrong, what to fix. Be specific. Reference line numbers or logic errors. If all tests pass, congratulate and mention time/space complexity."
}

Rules:
- Be rigorous. Actually trace the logic step by step.
- For "pass" status, ALL test cases must pass.
- Include at least one edge case (empty input, single element, large values, etc.)
- If the code has syntax errors, set status to "error" with explanation.
- The "actual" field should reflect what the code WOULD produce, not what it should produce."""


async def verify_code(code: str, language: str, problem: dict, problem_title: str = "") -> dict:
    if not code.strip():
        return {
            "status": "error",
            "summary": "No code provided.",
            "results": [],
            "feedback": "Write your solution code and try again.",
        }

    desc = problem.get("description", "")
    examples = problem.get("examples", [])
    examples_str = ""
    for i, ex in enumerate(examples, 1):
        if isinstance(ex, dict):
            examples_str += f"\nExample {i}: Input: {ex.get('input', '?')} → Output: {ex.get('output', '?')}"
        else:
            examples_str += f"\nExample {i}: {ex}"

    user_msg = f"""Problem: {problem_title or problem.get('title', 'Unknown')}
Description: {desc[:2000]}
{examples_str}

Language: {language}
Code:
```
{code}
```

Verify this solution. Trace through each test case carefully."""

    try:
        response = await _get_client().chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": VERIFY_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=1200,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        result = json.loads(raw)
        return {
            "status": result.get("status", "error"),
            "summary": result.get("summary", ""),
            "results": result.get("results", []),
            "feedback": result.get("feedback", ""),
        }
    except Exception as e:
        print(f"[Verifier] Error: {e}")
        return {
            "status": "error",
            "summary": f"Verification failed: {str(e)[:100]}",
            "results": [],
            "feedback": "Try again in a moment.",
        }
