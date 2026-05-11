# backend/app/services/standup_ai.py
"""
AI logic for the InternX Standup System — powered by Groq API.

Functions:
  - analyze_standup()        → detect vague updates, check consistency, generate follow-up
  - tag_blocker_role()       → detect which role a blocker targets
  - generate_scrum_summary() → end-of-standup AI Scrum Master summary + sprint risk
  - generate_manager_notes() → realistic AI manager follow-up messages per person
"""

import os
import json
import logging
from typing import Optional
from groq import AsyncGroq

logger = logging.getLogger(__name__)

# Model: fast, capable, free-tier friendly
GROQ_MODEL = "llama-3.3-70b-versatile"

# Lazy client — instantiated on first use so a missing key doesn't crash startup
_client: Optional[AsyncGroq] = None

def _get_client() -> AsyncGroq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. Add it to your .env file:\n"
                "  GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx"
            )
        _client = AsyncGroq(api_key=api_key)
    return _client


async def _chat(system: str, user: str, max_tokens: int = 500) -> str:
    """Helper: single-turn Groq chat, returns raw text."""
    response = await _get_client().chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=max_tokens,
        temperature=0.4,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return response.choices[0].message.content.strip()


def _parse_json(text: str) -> dict | list:
    """Strip markdown fences then parse JSON."""
    clean = text.replace("```json", "").replace("```", "").strip()
    return json.loads(clean)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Analyze a single standup for vagueness + consistency
# ─────────────────────────────────────────────────────────────────────────────

ANALYZE_SYSTEM = """You are an AI standup analyzer for InternX, an internship simulation platform.
You review daily standup submissions and evaluate them like an experienced engineering manager.

Your job:
1. Detect vague/low-quality updates (e.g. "worked on stuff", "did some coding", "was busy")
2. Check if today's "yesterday" is consistent with yesterday's "today plan"
3. Generate a realistic follow-up question if the update is vague or inconsistent

Rules:
- Be direct but constructive, like a real manager coaching an intern
- Vague score: 0 = very specific/good, 100 = completely vague/useless
- Vague indicators: generic verbs, no specific feature/component names, no measurable output
- Good indicators: specific component/endpoint/feature names, measurable progress, numbers
- If yesterday's "today" doesn't match today's "yesterday", that's an inconsistency

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "vague_score": 0-100,
  "vague_reason": "one sentence explaining the vague score, or null if score < 30",
  "consistency_ok": true or false,
  "consistency_note": "one sentence about the match/mismatch, or null if no prior plan",
  "ai_followup": "a specific follow-up question like a manager would ask, or null if update is good"
}"""


async def analyze_standup(
    yesterday: str,
    today: str,
    blockers: str,
    prior_today: Optional[str] = None,
    intern_role: Optional[str] = None,
) -> dict:
    """
    Analyze a standup submission.
    Returns dict with: vague_score, vague_reason, consistency_ok, consistency_note, ai_followup
    """
    prior_section = (
        f"\nYESTERDAY's 'Today' plan (what they promised): {prior_today}"
        if prior_today
        else "\nNo prior 'Today' plan available (first standup)."
    )

    user_msg = f"""Intern role: {intern_role or 'unknown'}

TODAY's standup:
  Yesterday (what they did): {yesterday}
  Today (what they plan): {today}
  Blockers: {blockers or 'None'}
{prior_section}

Analyze this standup."""

    try:
        text = await _chat(ANALYZE_SYSTEM, user_msg, max_tokens=400)
        return _parse_json(text)
    except Exception as e:
        logger.error(f"analyze_standup failed: {e}", exc_info=True)
        return {
            "vague_score": 0,
            "vague_reason": None,
            "consistency_ok": True,
            "consistency_note": None,
            "ai_followup": None,
        }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Detect which role/person a blocker is targeting
# ─────────────────────────────────────────────────────────────────────────────

TAG_SYSTEM = """You are analyzing a blocker from a developer's standup.
Identify which team role is responsible for resolving this blocker.

Roles available: frontend, backend, devops, design, fullstack, tester, ui_ux, mentor

Rules:
- "API not ready" → backend
- "Design not done" → design
- "CI failing" → devops
- "Unclear requirement" → mentor
- If unclear → null

Respond ONLY in JSON (no markdown, no extra text):
{"tagged_role": "backend" | "frontend" | "devops" | "design" | "fullstack" | "tester" | "ui_ux" | "mentor" | null}"""


async def tag_blocker_role(blocker_text: str) -> Optional[str]:
    """Detect which role is responsible for a blocker."""
    try:
        text = await _chat(TAG_SYSTEM, f"Blocker: {blocker_text}", max_tokens=60)
        return _parse_json(text).get("tagged_role")
    except Exception as e:
        logger.error(f"tag_blocker_role failed: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# 3. AI Scrum Master Summary
# ─────────────────────────────────────────────────────────────────────────────

SCRUM_SYSTEM = """You are the AI Scrum Master for InternX, an internship simulation platform.
After all team members submit their daily standups, you generate a professional standup summary.

Your summary should:
- Be written like a real Scrum Master's end-of-standup notes
- Call out blockers by name (mention which role is blocked waiting for what)
- Assess sprint risk based on: blocker count, vague updates, missed standups, ETA mismatches
- Suggest specific actions (e.g. "Backend should prioritize the auth API — Frontend is blocked")
- Sound like a real engineering team's standup, not generic advice

Sprint risk levels:
- LOW: all tasks progressing, no critical blockers, team is on track
- MEDIUM: some blockers or slowdowns, manageable with attention
- HIGH: critical dependency blocked, multiple people stuck, sprint goals at risk
- CRITICAL: widespread blockers, missed standups, sprint failing

Respond ONLY in this JSON format (no markdown, no extra text):
{
  "summary_text": "3-5 sentence professional summary mentioning specific names/roles/features",
  "sprint_risk": "low" | "medium" | "high" | "critical",
  "risk_reason": "one sentence explaining the risk level"
}"""


async def generate_scrum_summary(standup_data: list[dict], date: str) -> dict:
    """
    Generate AI Scrum Master summary for the day's standups.
    standup_data: list of {name, role, yesterday, today, blockers, eta_hours, is_late, missed}
    """
    if not standup_data:
        return {
            "summary_text": "No standup submissions today. The team did not check in.",
            "sprint_risk": "high",
            "risk_reason": "No standups submitted — sprint visibility is zero.",
        }

    team_lines = []
    for s in standup_data:
        if s.get("missed"):
            team_lines.append(f"- {s['name']} ({s.get('role', 'intern')}): ⚠️ MISSED standup")
        else:
            late_tag = " [LATE]" if s.get("is_late") else ""
            eta_tag = f" | ETA: {s['eta_hours']}h" if s.get("eta_hours") else ""
            blocker_tag = f" | BLOCKER: {s['blockers']}" if s.get("blockers") else " | No blockers"
            team_lines.append(
                f"- {s['name']} ({s.get('role', 'intern')}){late_tag}: "
                f"Yesterday: {s.get('yesterday', 'N/A')} | "
                f"Today: {s.get('today', 'N/A')}"
                f"{blocker_tag}{eta_tag}"
            )

    user_msg = f"""Date: {date}
Team standup submissions:

{chr(10).join(team_lines)}

Generate a scrum master summary for this standup."""

    try:
        text = await _chat(SCRUM_SYSTEM, user_msg, max_tokens=600)
        return _parse_json(text)
    except Exception as e:
        logger.error(f"generate_scrum_summary failed: {e}", exc_info=True)
        return {
            "summary_text": "Unable to generate AI summary at this time.",
            "sprint_risk": "medium",
            "risk_reason": "Summary generation failed.",
        }


# ─────────────────────────────────────────────────────────────────────────────
# 4. AI Manager Follow-up Messages
# ─────────────────────────────────────────────────────────────────────────────

MANAGER_SYSTEM = """You are an AI Engineering Manager at a tech startup, posting standup follow-up messages on Slack.
You review the team's standup and post direct, realistic messages to specific team members.

Rules:
- Write like a real manager — direct, helpful, sometimes pushing for accountability
- Mention specific names and their specific updates
- Address blockers with action items ("Backend, please give ETA on /auth/login API by 2PM")
- Suggest what blocked people should work on in the meantime
- If someone has a vague update, call it out gently ("Can you be more specific about what you completed?")
- 3-5 messages max, each targeted at a specific person or situation
- Keep each message under 30 words

Respond ONLY as a JSON array (no markdown, no extra text):
[
  {"to": "name or role", "message": "direct manager message"},
  ...
]"""


async def generate_manager_notes(standup_data: list[dict]) -> list[dict]:
    """Generate AI manager follow-up notes after standup."""
    if not standup_data:
        return []

    team_lines = []
    for s in standup_data:
        if s.get("missed"):
            team_lines.append(f"- {s['name']}: MISSED standup today")
        else:
            blocker = s.get("blockers", "")
            vague = s.get("vague_score", 0)
            team_lines.append(
                f"- {s['name']} ({s.get('role', 'intern')}): "
                f"Yesterday: {s.get('yesterday', 'N/A')} | "
                f"Today: {s.get('today', 'N/A')}"
                + (f" | BLOCKED: {blocker}" if blocker else "")
                + (f" | [vague update, score={vague}]" if vague and vague > 50 else "")
            )

    try:
        text = await _chat(MANAGER_SYSTEM, "\n".join(team_lines), max_tokens=400)
        return _parse_json(text)
    except Exception as e:
        logger.error(f"generate_manager_notes failed: {e}", exc_info=True)
        return []


# ─────────────────────────────────────────────────────────────────────────────
# 5. AI Manager Threaded Reply (back-and-forth conversation)
# ─────────────────────────────────────────────────────────────────────────────

THREAD_REPLY_SYSTEM = """You are an AI Engineering Manager at a tech startup conducting a standup follow-up thread.
You asked the intern a follow-up question for a SPECIFIC reason (consistency mismatch, vague update, or both).
The intern has now replied. Continue the conversation naturally, staying focused on THAT reason.

Rules:
- Always read WHY the follow-up was triggered (see "Reason for follow-up" in the context)
- If triggered by CONSISTENCY MISMATCH: the intern deviated from their plan. Focus on understanding
  the task switch — was it approved? Does the original task still need to be done? Who knows about it?
- If triggered by VAGUE UPDATE: the intern's description lacked specifics. Focus on getting measurable details.
- If triggered by BOTH: address the consistency mismatch first, it's the higher priority.
- If their answer satisfactorily explains the situation, acknowledge and close the loop naturally.
- If the explanation is still incomplete, ask exactly ONE targeted follow-up — not a repeat of the original.
- If they're blocked or struggling, offer a concrete suggestion.
- Keep responses under 40 words — short, direct, Slack-style. Sound like a real human manager, not a bot.
- NEVER re-ask a question the intern already answered.

Respond with ONLY the manager's reply — no JSON, no formatting, no preamble."""


async def generate_manager_thread_reply(
    standup: dict,
    thread_history: list[dict],
    intern_reply: str,
    intern_name: str = "intern",
    intern_role: str = "intern",
) -> str:
    """
    Generate the AI manager's response in a threaded conversation.
    Passes full standup context including WHY the follow-up was triggered,
    so the manager stays focused on the actual issue (consistency vs vagueness).
    """
    # Determine root cause so the AI knows what to focus on
    consistency_ok  = standup.get("consistency_ok", True)
    vague_score     = standup.get("vague_score", 0)
    prior_today     = standup.get("prior_today")       # yesterday's "today" plan
    consistency_note = standup.get("consistency_note")

    reason_parts = []
    if not consistency_ok:
        prior_plan_hint = f' (yesterday they planned: "{prior_today}")' if prior_today else ""
        note_hint = f" Note: {consistency_note}" if consistency_note else ""
        reason_parts.append(
            f"CONSISTENCY MISMATCH{prior_plan_hint} — "
            f"what they reported doing today differs from what they planned yesterday.{note_hint}"
        )
    if vague_score and vague_score > 50:
        reason_parts.append(f"VAGUE UPDATE (score {vague_score}/100) — the update lacked specific details.")

    if not reason_parts:
        reason_parts.append("General follow-up — update needed more clarity.")

    reason_block = "\n".join(f"  - {r}" for r in reason_parts)

    # Build readable thread transcript
    transcript_lines = []
    for msg in thread_history:
        role_label = "Manager" if msg.get("role") == "manager" else intern_name
        transcript_lines.append(f"{role_label}: {msg.get('text', '')}")
    transcript_lines.append(f"{intern_name}: {intern_reply}")
    transcript = "\n".join(transcript_lines)

    user_msg = f"""Intern: {intern_name} ({intern_role})

Standup:
  Yesterday (what they did): {standup.get('yesterday', 'N/A')}
  Today (what they plan):    {standup.get('today', 'N/A')}
  Blockers:                  {standup.get('blockers') or 'None'}

Reason for follow-up:
{reason_block}

Thread so far:
{transcript}

Respond as the manager to {intern_name}'s latest message. Stay focused on the reason for follow-up above."""

    try:
        return await _chat(THREAD_REPLY_SYSTEM, user_msg, max_tokens=120)
    except Exception as e:
        logger.error(f"generate_manager_thread_reply failed: {e}", exc_info=True)
        return "Got it, thanks for the clarification. Let me know if anything else changes."