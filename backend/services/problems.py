import json
import os
import httpx

from backend.data.lc_slug_map import LC_SLUG_MAP

CACHE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "problems_cache.json")
LEETCODE_GRAPHQL = "https://leetcode.com/graphql"
ALFA_API = "https://alfa-leetcode-api.onrender.com"

_cache: dict | None = None


def _load_cache() -> dict:
    global _cache
    if _cache is not None:
        return _cache
    try:
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            _cache = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        _cache = {}
    return _cache


def _save_to_cache(lc_num: str, data: dict):
    cache = _load_cache()
    cache[lc_num] = data
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
    except Exception:
        pass


def _normalize(raw: dict) -> dict:
    return {
        "title": raw.get("questionTitle") or raw.get("title", ""),
        "description": raw.get("content") or raw.get("description", ""),
        "difficulty": raw.get("difficulty", ""),
        "constraints": raw.get("constraints", []),
        "examples": raw.get("examples", raw.get("exampleTestcases", [])),
        "topicTags": [t.get("name", t) if isinstance(t, dict) else t for t in raw.get("topicTags", [])],
    }


FIND_SLUG_QUERY = """
query problemsetQuestionList($filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(categorySlug: "", limit: 5, skip: 0, filters: $filters) {
    questions: data {
      frontendQuestionId: questionFrontendId
      title
      titleSlug
      difficulty
      topicTags { name }
    }
  }
}"""

QUESTION_DETAIL_QUERY = """
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    title
    titleSlug
    content
    difficulty
    topicTags { name }
    exampleTestcaseList
  }
}"""


async def _fetch_via_graphql(lc_num: str) -> dict | None:
    """Tier 1: Use LeetCode GraphQL to find a problem by number."""
    headers = {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
        "User-Agent": "Mozilla/5.0",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as http:
            # Step A: find the slug for this problem number
            slug = LC_SLUG_MAP.get(int(lc_num)) if lc_num.isdigit() else None

            if not slug:
                resp = await http.post(LEETCODE_GRAPHQL, headers=headers, json={
                    "query": FIND_SLUG_QUERY,
                    "variables": {"filters": {"searchKeywords": lc_num}},
                })
                if resp.status_code == 200:
                    data = resp.json().get("data", {}).get("problemsetQuestionList", {})
                    questions = data.get("questions", [])
                    for q in questions:
                        if str(q.get("frontendQuestionId")) == str(lc_num):
                            slug = q["titleSlug"]
                            break
                    if not slug and questions:
                        slug = questions[0].get("titleSlug")

            if not slug:
                return None

            # Step B: get full details
            resp = await http.post(LEETCODE_GRAPHQL, headers=headers, json={
                "query": QUESTION_DETAIL_QUERY,
                "variables": {"titleSlug": slug},
            })
            if resp.status_code == 200:
                q = resp.json().get("data", {}).get("question")
                if q and q.get("content"):
                    result = {
                        "title": q.get("title", ""),
                        "description": q.get("content", ""),
                        "difficulty": q.get("difficulty", ""),
                        "constraints": [],
                        "examples": q.get("exampleTestcaseList", []),
                        "topicTags": [t["name"] for t in q.get("topicTags", []) if isinstance(t, dict)],
                    }
                    _save_to_cache(lc_num, result)
                    return result
    except Exception as e:
        print(f"[Problems] GraphQL fetch error: {e}")
    return None


async def _fetch_via_alfa(slug: str) -> dict | None:
    """Tier 2: Use alfa-leetcode-api as a fallback."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            resp = await http.get(f"{ALFA_API}/select", params={"titleSlug": slug})
            if resp.status_code == 200:
                data = resp.json()
                if data.get("questionTitle") or data.get("content"):
                    return _normalize(data)
    except Exception:
        pass
    return None


async def resolve_problem(lc_id: str | None, problem_text: str | None) -> dict | None:
    """Resolve a LC problem. Works with any problem number (1–3000+)."""
    if problem_text:
        return {"title": "Custom Problem", "description": problem_text, "constraints": [], "examples": [], "topicTags": []}

    if not lc_id:
        return None

    lc_num = lc_id.strip().lstrip("0")
    if not lc_num:
        return None

    # Tier 1: LeetCode GraphQL (works for any number)
    result = await _fetch_via_graphql(lc_num)
    if result:
        return result

    # Tier 2: alfa-leetcode-api (if we have a slug)
    slug = LC_SLUG_MAP.get(int(lc_num)) if lc_num.isdigit() else None
    if slug:
        result = await _fetch_via_alfa(slug)
        if result:
            _save_to_cache(lc_num, result)
            return result

    # Tier 3: local cache
    cache = _load_cache()
    cached = cache.get(lc_num) or cache.get(str(lc_num))
    if cached:
        return cached if "title" in cached else _normalize(cached)

    return None
