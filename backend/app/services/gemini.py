"""
Gemini AI Service for Smart Locker Allocation.

Uses Google Gemini to:
1. Generate intelligent locker allocation plans with natural-language reasoning
2. Answer admin questions about the current state of the system (conversational chat)
"""
from __future__ import annotations

import json
import re
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _get_client(model_name: str | None = None):
    """Lazily initialise the Gemini client so the app starts even without a key."""
    from app.core.config import settings
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. "
            "Add it to .env and restart the server."
        )
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    target_model = model_name or settings.GEMINI_MODEL or "gemini-flash-latest"
    return genai.GenerativeModel(target_model)


# ─────────────────────────────────────────────────────────────────────────────
# ALLOCATION
# ─────────────────────────────────────────────────────────────────────────────

ALLOCATION_SYSTEM_PROMPT = """
You are an intelligent locker allocation assistant for a university.
Your task is to assign lockers to students according to these priority rules:

TIER 1 (Highest Priority) — Students with inclusive/disability status:
  - disability, orphan, vision_impairment, hearing_impairment, or other_inclusive
  - Must get Floor 1 lockers (ground floor, most accessible)

TIER 2 — Active students:
  - activity_score >= 70 (they use the system regularly)
  - Prefer floors matching their course year

TIER 3 — High GPA students:
  - gpa >= 3.4
  - Prefer floors matching their course year

TIER 4 — General stream:
  - All remaining students
  - Cluster by group when possible

LOCKER SCORING (choose the BEST locker for each student):
  - Tier 1: Always prefer Floor 1, smallest floor number
  - Others: Prefer floor = student's course year (1st year → Floor 1, etc.)
  - Prefer lockers with remaining capacity > 0
  - Cluster students from the same group into the same locker when possible (capacity > 1)

OUTPUT: Return ONLY valid JSON — no markdown, no explanation outside the JSON.
The JSON must match this schema exactly:
{
  "summary": "Brief overall summary of the allocation in Russian",
  "allocations": [
    {
      "student_id": <int>,
      "locker_id": <int>,
      "tier": <1|2|3|4>,
      "reason": "<concise reason in Russian why this student got this locker>"
    }
  ],
  "tier_counts": {"1": <int>, "2": <int>, "3": <int>, "4": <int>},
  "insights": "<2-3 sentence strategic note about the allocation in Russian>"
}
"""


async def gemini_allocate(
    students: list[dict[str, Any]],
    lockers: list[dict[str, Any]],
    extra_instruction: str = "",
) -> dict[str, Any]:
    """
    Ask Gemini to allocate lockers to students with automatic model fallback.
    """
    from app.core.config import settings

    user_message = f"""
Here is the current data:

UNASSIGNED STUDENTS ({len(students)} total):
{json.dumps(students, ensure_ascii=False, indent=2)}

AVAILABLE LOCKERS ({len(lockers)} total, only those with remaining_capacity > 0):
{json.dumps([l for l in lockers if l.get("remaining_capacity", 0) > 0], ensure_ascii=False, indent=2)}

{f"ADDITIONAL ADMIN INSTRUCTION: {extra_instruction}" if extra_instruction else ""}

Please allocate as many students as possible to available lockers following the priority rules.
Respond ONLY with valid JSON matching the schema.
"""

    candidate_models = [
        settings.GEMINI_MODEL,
        "gemini-flash-latest",
        "gemini-pro-latest",
        "gemini-flash-lite-latest",
        "gemini-2.5-flash-lite",
    ]
    # Remove duplicates while preserving order
    seen = set()
    models_to_try = [m for m in candidate_models if m and not (m in seen or seen.add(m))]

    last_error = None
    for model_name in models_to_try:
        try:
            model = _get_client(model_name)
            response = model.generate_content(
                [ALLOCATION_SYSTEM_PROMPT, user_message],
                generation_config={
                    "temperature": 0.2,
                    "max_output_tokens": 8192,
                    "response_mime_type": "application/json",
                },
            )
            raw = response.text.strip()
            # Strip any accidental markdown fences
            raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
            raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.error("Gemini returned invalid JSON with model %s: %s", model_name, exc)
            raise ValueError(f"Gemini returned non-JSON response: {exc}") from exc
        except Exception as exc:
            logger.warning("Gemini model %s failed: %s. Trying fallback...", model_name, exc)
            last_error = exc
            continue

    logger.error("All candidate Gemini models failed. Last error: %s", last_error)
    raise last_error or RuntimeError("Failed to generate allocation with Gemini API.")


# ─────────────────────────────────────────────────────────────────────────────
# CHAT
# ─────────────────────────────────────────────────────────────────────────────

CHAT_SYSTEM_PROMPT = """
You are a helpful AI assistant for a university locker management system.
You have access to the current system snapshot (students, lockers, assignments).
Answer the admin's questions concisely and in the SAME LANGUAGE as the question
(Russian or English). You may suggest allocation strategies, explain decisions,
or answer factual questions about the data. Keep answers under 200 words.
"""


async def gemini_chat(
    message: str,
    history: list[dict[str, str]],
    context: dict[str, Any],
) -> str:
    """
    Conversational Q&A with Gemini about the system state.

    Args:
        message:  Admin's new message
        history:  List of {"role": "user"|"model", "parts": [str]} dicts
        context:  Current system snapshot dict

    Returns:
        Gemini's text reply.
    """
    model = _get_client()

    context_block = f"""
SYSTEM SNAPSHOT:
- Total students: {context.get('total_students', '?')}
- Unassigned students: {context.get('unassigned_students', '?')}
- Total lockers: {context.get('total_lockers', '?')}
- Available spots: {context.get('available_spots', '?')}
- Tier 1 (Inclusive): {context.get('tier_1_count', '?')}
- Tier 2 (Active ≥70): {context.get('tier_2_count', '?')}
- Tier 3 (GPA ≥3.4): {context.get('tier_3_count', '?')}
- Tier 4 (General): {context.get('tier_4_count', '?')}
- Floors available: {context.get('floors', '?')}
"""

    # Build chat session
    chat = model.start_chat(history=history)
    full_message = f"{CHAT_SYSTEM_PROMPT}\n\n{context_block}\n\nAdmin: {message}"

    try:
        response = chat.send_message(
            full_message,
            generation_config={"temperature": 0.7, "max_output_tokens": 512},
        )
        return response.text
    except Exception as exc:
        logger.error("Gemini chat error: %s", exc)
        raise
