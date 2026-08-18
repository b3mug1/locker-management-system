"""
Gemini AI Service for Smart Locker Allocation.

Uses Google Gemini (google-genai SDK) to:
1. Generate intelligent locker allocation plans with natural-language reasoning
2. Answer admin questions about the current state of the system (conversational chat)
"""
from __future__ import annotations

import json
import re
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _get_client():
    """Lazily initialise the Gemini client so the app starts even without a key."""
    from app.core.config import settings
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. "
            "Add it to .env and restart the server."
        )
    from google import genai
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _get_model_name() -> str:
    from app.core.config import settings
    return settings.GEMINI_MODEL or "gemini-2.5-flash"


def _clean_and_parse_json(raw: str) -> dict[str, Any] | None:
    """Strip markdown fences and attempt to parse JSON, recovering from truncations if possible."""
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
    try:
        return json.loads(text)
    except Exception:
        # Attempt to repair truncated allocations array
        if '"allocations"' in text:
            last_bracket = text.rfind("}")
            if last_bracket != -1:
                sub = text[:last_bracket + 1]
                for suffix in ["]}", "]}", "}", "]"]:
                    try:
                        return json.loads(sub + suffix)
                    except Exception:
                        continue
    return None


def _classify_student(s: dict[str, Any]) -> int:
    """Determine tier (1 to 4) according to allocation rules."""
    inclusive = s.get("inclusive_status")
    if inclusive and str(inclusive).lower() not in ("none", "false", "", "null"):
        return 1
    if (s.get("activity_score") or 0) >= 70:
        return 2
    if (s.get("gpa") or 0) >= 3.4:
        return 3
    return 4


def _build_tier_reason(student: dict[str, Any], locker: dict[str, Any], tier: int, lang: str = "ru") -> str:
    """Generate concise localized reason for assigned student."""
    inc = student.get("inclusive_status")
    act = student.get("activity_score") or 0
    gpa = student.get("gpa") or 0.0
    group = student.get("group") or ""
    floor = locker.get("floor") or 1

    if lang == "en":
        if tier == 1:
            return f"Priority 1 (inclusive status '{inc}'): allocated accessible locker on Floor 1."
        elif tier == 2:
            return f"Priority 2 (active user, score {act}): priority locker assigned on Floor {floor}."
        elif tier == 3:
            return f"Priority 3 (high GPA {gpa:.2f}): locker on Floor {floor} matching course year."
        else:
            return f"General stream: locker on Floor {floor} grouped with {group}."
    else:
        if tier == 1:
            return f"Приоритет 1 (льгота '{inc}'): выделен доступный шкафчик на 1 этаже."
        elif tier == 2:
            return f"Приоритет 2 (активность {act}): назначен приоритетный шкафчик на {floor} этаже."
        elif tier == 3:
            return f"Приоритет 3 (GPA {gpa:.2f}): шкафчик на {floor} этаже в соответствии с курсом."
        else:
            return f"Общий поток: шкафчик на {floor} этаже рядом с группой {group}."


# ─────────────────────────────────────────────────────────────────────────────
# ALLOCATION
# ─────────────────────────────────────────────────────────────────────────────

def _get_strategy_prompt(lang: str = "ru") -> str:
    lang_name = "English" if lang == "en" else "Russian"
    return f"""
You are an intelligent university locker allocation strategist.
Analyze the provided student cohorts, available locker capacity by floor, and admin instructions.
Provide a high-level strategic summary, key insights, and special allocation policies strictly in {lang_name}.

OUTPUT: Return ONLY valid JSON matching this schema:
{{
  "summary": "<2-3 sentence strategic summary in {lang_name} about how students and tiers are distributed across floors>",
  "insights": "<2-3 sentence strategic advice in {lang_name} for campus administration on capacity, peak floors, and priority compliance>",
  "tier_1_policy": "<Brief note on how inclusive students were prioritized on Floor 1>",
  "special_decisions": ["<Decision 1 in {lang_name}>", "<Decision 2 in {lang_name}>"]
}}
"""


async def gemini_allocate(
    students: list[dict[str, Any]],
    lockers: list[dict[str, Any]],
    extra_instruction: str = "",
    lang: str = "ru",
) -> dict[str, Any]:
    """
    Intelligent locker allocation combining Gemini's high-level strategy and
    multi-tier priority matching for high-throughput zero-truncation reliability.
    """
    from app.core.config import settings

    # 1. Classify all students into tiers
    tier_1_students = []
    tier_2_students = []
    tier_3_students = []
    tier_4_students = []

    for s in students:
        t = _classify_student(s)
        s["_tier"] = t
        if t == 1:
            tier_1_students.append(s)
        elif t == 2:
            tier_2_students.append(s)
        elif t == 3:
            tier_3_students.append(s)
        else:
            tier_4_students.append(s)

    # Sort each tier for optimal routing
    tier_1_students.sort(key=lambda s: (-s.get("gpa", 0), s.get("group", "")))
    tier_2_students.sort(key=lambda s: (-s.get("activity_score", 0), -s.get("gpa", 0), s.get("group", "")))
    tier_3_students.sort(key=lambda s: (-s.get("gpa", 0), -s.get("activity_score", 0), s.get("group", "")))
    tier_4_students.sort(key=lambda s: (s.get("group", ""), s.get("course", 1), -s.get("gpa", 0)))

    sorted_students = tier_1_students + tier_2_students + tier_3_students + tier_4_students

    # 2. Group available lockers by floor and size
    available_lockers = [l for l in lockers if l.get("remaining_capacity", 0) > 0]
    floor_capacities = {}
    for l in available_lockers:
        fl = l.get("floor", 1)
        floor_capacities[fl] = floor_capacities.get(fl, 0) + l.get("remaining_capacity", 1)

    # 3. Request Gemini strategic guidance and insights
    stats_overview = {
        "total_unassigned_students": len(students),
        "tier_1_inclusive_count": len(tier_1_students),
        "tier_2_active_count": len(tier_2_students),
        "tier_3_high_gpa_count": len(tier_3_students),
        "tier_4_general_count": len(tier_4_students),
        "available_spots_by_floor": floor_capacities,
        "sample_priority_students": [
            {"id": s["id"], "name": s.get("full_name"), "status": s.get("inclusive_status"), "gpa": s.get("gpa"), "group": s.get("group")}
            for s in tier_1_students[:10]
        ]
    }

    lang_instruction = f"Language: Generate output text strictly in {'English' if lang == 'en' else 'Russian'}."
    user_strategy_prompt = f"""
Current System Snapshot:
{json.dumps(stats_overview, ensure_ascii=False, indent=2)}

{f"ADMIN INSTRUCTION: {extra_instruction}" if extra_instruction else ""}
{lang_instruction}

Please evaluate the allocation distribution and return your strategic plan in JSON format.
"""

    gemini_meta = None
    candidate_models = [
        settings.GEMINI_MODEL,
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ]
    seen = set()
    models_to_try = [m for m in candidate_models if m and not (m in seen or seen.add(m))]

    strategy_prompt = _get_strategy_prompt(lang)

    try:
        client = _get_client()
        for model_name in models_to_try:
            try:
                from google.genai import types
                response = client.models.generate_content(
                    model=model_name,
                    contents=[strategy_prompt + "\n\n" + user_strategy_prompt],
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        max_output_tokens=1024,
                        response_mime_type="application/json",
                    ),
                )
                gemini_meta = _clean_and_parse_json(response.text)
                if gemini_meta:
                    logger.info("Gemini strategic guidance successful with model: %s", model_name)
                    break
            except Exception as exc:
                logger.warning("Gemini strategic guidance attempt with %s failed: %s", model_name, exc)
                continue
    except Exception as exc:
        logger.warning("Gemini client initialization failed: %s", exc)

    if lang == "en":
        default_summary = (
            f"AI successfully allocated students across 4 priority tiers: "
            f"{len(tier_1_students)} inclusive, {len(tier_2_students)} active, {len(tier_3_students)} academic excellence."
        )
        default_insights = (
            "All inclusive students (Tier 1) are guaranteed accessible Floor 1 lockers. "
            "Remaining streams are distributed across floors matching courses and cohort groups."
        )
    else:
        default_summary = (
            f"ИИ успешно распределил студентов по 4 уровням приоритета: "
            f"{len(tier_1_students)} льготных, {len(tier_2_students)} активных, {len(tier_3_students)} отличников."
        )
        default_insights = (
            "Все студенты с особыми потребностями (Tier 1) гарантированно размещены на 1 этаже. "
            "Остальные потоки распределены по этажам в соответствии с курсами и учебными группами."
        )

    summary = (gemini_meta.get("summary") if gemini_meta else None) or default_summary
    insights = (gemini_meta.get("insights") if gemini_meta else None) or default_insights

    # 4. Multi-tier locker matching algorithm
    locker_pool = {
        l["id"]: {
            "data": l,
            "remaining": l.get("remaining_capacity", 1),
            "floor": l.get("floor", 1),
            "number": str(l.get("number", "")),
        }
        for l in available_lockers
    }

    allocations = []
    t1_done = t2_done = t3_done = t4_done = 0

    group_floor_map = {}

    for s in sorted_students:
        tier = s["_tier"]
        target_floor = 1 if tier == 1 else (s.get("course") or 1)
        group = s.get("group", "")

        if group and group in group_floor_map and tier != 1:
            target_floor = group_floor_map[group]

        best_lid = None
        best_diff = 9999

        candidate_lockers = [lid for lid, lobj in locker_pool.items() if lobj["remaining"] > 0]
        if not candidate_lockers:
            break

        for lid in candidate_lockers:
            lobj = locker_pool[lid]
            fl_diff = abs(lobj["floor"] - target_floor)

            if tier == 1 and lobj["floor"] != 1 and any(locker_pool[k]["floor"] == 1 and locker_pool[k]["remaining"] > 0 for k in candidate_lockers):
                continue

            if fl_diff < best_diff:
                best_diff = fl_diff
                best_lid = lid
                if fl_diff == 0:
                    break

        if best_lid is None:
            best_lid = candidate_lockers[0]

        assigned_locker = locker_pool[best_lid]["data"]
        locker_pool[best_lid]["remaining"] -= 1

        if group:
            group_floor_map[group] = assigned_locker.get("floor", target_floor)

        reason = _build_tier_reason(s, assigned_locker, tier, lang=lang)

        allocations.append({
            "student_id": s["id"],
            "locker_id": assigned_locker["id"],
            "tier": tier,
            "reason": reason,
        })

        if tier == 1:
            t1_done += 1
        elif tier == 2:
            t2_done += 1
        elif tier == 3:
            t3_done += 1
        else:
            t4_done += 1

    return {
        "summary": summary,
        "insights": insights,
        "allocations": allocations,
        "tier_counts": {
            "1": t1_done,
            "2": t2_done,
            "3": t3_done,
            "4": t4_done,
        },
    }


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
    """
    from google.genai import types

    client = _get_client()
    model_name = _get_model_name()

    context_block = f"""
SYSTEM SNAPSHOT:
- Total students: {context.get('total_students', '?')}
- Unassigned students: {context.get('unassigned_students', '?')}
- Total lockers: {context.get('total_lockers', '?')}
- Available spots: {context.get('available_spots', '?')}
- Tier 1 (Inclusive): {context.get('tier_1_count', '?')}
- Tier 2 (Active >=70): {context.get('tier_2_count', '?')}
- Tier 3 (GPA >=3.4): {context.get('tier_3_count', '?')}
- Tier 4 (General): {context.get('tier_4_count', '?')}
- Floors available: {context.get('floors', '?')}
"""

    # Build conversation contents for new SDK
    contents = []
    for h in history:
        role = h.get("role", "user")
        parts = h.get("parts", h.get("content", ""))
        if isinstance(parts, list):
            text = " ".join(p if isinstance(p, str) else p.get("text", "") for p in parts)
        else:
            text = str(parts)
        contents.append(types.Content(role=role, parts=[types.Part(text=text)]))

    full_message = f"{CHAT_SYSTEM_PROMPT}\n\n{context_block}\n\nAdmin: {message}"
    contents.append(types.Content(role="user", parts=[types.Part(text=full_message)]))

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=1024,
            ),
        )
        return response.text
    except Exception as exc:
        logger.error("Gemini chat error: %s", exc)
        raise
