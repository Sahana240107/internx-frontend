# backend/app/routers/standup.py
"""
AI Standup System for InternX.

Endpoints:
  GET  /api/standup/status              → standup window status (open/closed/upcoming)
  POST /api/standup/submit              → submit daily standup
  GET  /api/standup/feed                → team standup feed for today
  GET  /api/standup/my-history          → current user's standup history
  GET  /api/standup/summary             → today's AI scrum master summary
  POST /api/standup/trigger-summary     → manually trigger summary generation
  GET  /api/standup/consistency-check   → check if yesterday's today matches today's yesterday

DB tables used (matching actual schema):
  - standups             (group_id, not cohort_id)
  - standup_summaries    (group_id, not cohort_id)
  - standup_blocker_escalations
  - group_members        (group_id + user_id + intern_role, NOT project_members)
  - profiles             (id, name, avatar_url, intern_role)

Time window: 9:00 AM – 11:00 AM IST (UTC+5:30).
Submissions outside this window are marked as late.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date, timezone, timedelta
import uuid
import logging

from app.core.auth import get_current_user
from app.core.database import supabase_admin
from app.routers.notifications import upsert_notification
from app.services.standup_ai import (
    analyze_standup,
    tag_blocker_role,
    generate_scrum_summary,
    generate_manager_notes,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/standup", tags=["standup"])

# ─── Config ───────────────────────────────────────────────────────────────────
IST = timezone(timedelta(hours=5, minutes=30))
STANDUP_OPEN_HOUR  = 9   # 9:00 AM IST
STANDUP_CLOSE_HOUR = 11  # 11:00 AM IST


def _now_ist() -> datetime:
    return datetime.now(IST)


def _today_ist() -> date:
    return _now_ist().date()


def _standup_window_status() -> dict:
    now    = _now_ist()
    today  = now.date()
    opens  = datetime(today.year, today.month, today.day, STANDUP_OPEN_HOUR,  0, 0, tzinfo=IST)
    closes = datetime(today.year, today.month, today.day, STANDUP_CLOSE_HOUR, 0, 0, tzinfo=IST)

    if opens <= now < closes:
        status = "open"
    elif now >= closes:
        status = "closed"
    else:
        status = "upcoming"

    return {
        "status": status,
        "opens_at": opens.isoformat(),
        "closes_at": closes.isoformat(),
        "current_time_ist": now.isoformat(),
        "is_late": now >= closes,
        "date": today.isoformat(),
    }


def _is_late() -> bool:
    now    = _now_ist()
    closes = datetime(now.year, now.month, now.day, STANDUP_CLOSE_HOUR, 0, 0, tzinfo=IST)
    return now >= closes


# ─── Helper: resolve group_id for current user ───────────────────────────────

def _resolve_group_id(user_id: str, provided: Optional[str] = None) -> Optional[str]:
    """
    Return the group_id to use.
    If provided, use it directly.
    Otherwise look up the user's active group from group_members.
    """
    if provided:
        return provided
    res = (
        supabase_admin.table("group_members")
        .select("group_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return res.data[0]["group_id"] if res.data else None


# ─── Pydantic ──────────────────────────────────────────────────────────────────

class StandupSubmit(BaseModel):
    yesterday:  str
    today:      str
    blockers:   str = ""
    eta_hours:  Optional[float] = None
    # frontend passes cohort_id; we map it to group_id internally
    cohort_id:  Optional[str] = None
    group_id:   Optional[str] = None          # accept either name


class ManagerReply(BaseModel):
    standup_id:     str
    reply:          str
    thread_history: list = []   # full prior turns for context


# ─── Routes ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_standup_status(current_user: dict = Depends(get_current_user)):
    """Get current standup window status and whether user submitted today."""
    window = _standup_window_status()
    today  = _today_ist().isoformat()

    submitted_res = (
        supabase_admin.table("standups")
        .select("id, submitted_at, is_late, ai_followup, vague_score, consistency_ok")
        .eq("user_id", current_user["id"])
        .eq("date", today)
        .limit(1)
        .execute()
    )
    submitted = submitted_res.data[0] if submitted_res.data else None

    return {
        **window,
        "submitted_today": submitted is not None,
        "submission": submitted,
    }


@router.post("/submit")
async def submit_standup(
    body: StandupSubmit,
    current_user: dict = Depends(get_current_user),
):
    """Submit today's standup. Runs AI analysis immediately via Groq."""
    user_id = current_user["id"]
    today   = _today_ist().isoformat()

    # Resolve group_id (accept either field name from frontend)
    group_id = body.group_id or body.cohort_id
    group_id = _resolve_group_id(user_id, group_id)

    # Duplicate check
    existing = (
        supabase_admin.table("standups")
        .select("id")
        .eq("user_id", user_id)
        .eq("date", today)
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(400, "You have already submitted your standup today.")

    # Content validation
    if len(body.yesterday.strip()) < 10:
        raise HTTPException(400, "Yesterday field is too short. Be specific about what you did.")
    if len(body.today.strip()) < 10:
        raise HTTPException(400, "Today field is too short. Be specific about your plan.")

    # Fetch prior standup for consistency check
    yesterday_date = (_today_ist() - timedelta(days=1)).isoformat()
    prior_res = (
        supabase_admin.table("standups")
        .select("today")
        .eq("user_id", user_id)
        .eq("date", yesterday_date)
        .limit(1)
        .execute()
    )
    prior_today = prior_res.data[0]["today"] if prior_res.data else None

    # AI analysis (Groq)
    analysis = await analyze_standup(
        yesterday=body.yesterday,
        today=body.today,
        blockers=body.blockers,
        prior_today=prior_today,
        intern_role=current_user.get("intern_role"),
    )

    is_late    = _is_late()
    standup_id = str(uuid.uuid4())
    now_iso    = datetime.now(timezone.utc).isoformat()

    standup_row = {
        "id":               standup_id,
        "user_id":          user_id,
        "group_id":         group_id,
        "date":             today,
        "yesterday":        body.yesterday.strip(),
        "today":            body.today.strip(),
        "blockers":         body.blockers.strip(),
        "eta_hours":        body.eta_hours,
        "submitted_at":     now_iso,
        "is_late":          is_late,
        "vague_score":      analysis.get("vague_score", 0),
        "consistency_ok":   analysis.get("consistency_ok", True),
        "consistency_note": analysis.get("consistency_note"),   # e.g. "planned dashboard, did chatbot"
        "ai_followup":      analysis.get("ai_followup"),
        "prior_today":      prior_today,                        # yesterday's plan — gives thread reply context
    }

    result = supabase_admin.table("standups").insert(standup_row).execute()
    if not result.data:
        raise HTTPException(500, "Failed to save standup")

    # Process blockers
    blocker_records: list[dict] = []
    if body.blockers.strip():
        blocker_texts = [
            b.strip()
            for b in body.blockers.replace(";", "\n").split("\n")
            if b.strip()
        ]
        for bt in blocker_texts:
            tagged_role = await tag_blocker_role(bt)
            blocker_records.append({
                "id":           str(uuid.uuid4()),
                "standup_id":   standup_id,
                "blocker_text": bt,
                "tagged_role":  tagged_role,
                "status":       "open",
                "created_at":   now_iso,
            })

        if blocker_records:
            supabase_admin.table("standup_blocker_escalations").insert(blocker_records).execute()

        # Notify tagged teammates
        if group_id:
            await _escalate_blockers(
                blocker_records=blocker_records,
                reporter_name=current_user.get("name", "A teammate"),
                group_id=group_id,
                standup_id=standup_id,
            )

    # Late notification
    if is_late:
        upsert_notification(
            user_id=user_id,
            key="standup_late",
            type_="standup",
            title="⏰ Late Standup Submitted",
            body=f"Your standup for {today} was submitted late. Try to submit between 9–11 AM.",
            icon="⏰",
            href="/dashboard/standup",
        )

    # Vague follow-up notification
    followup = analysis.get("ai_followup")
    if followup:
        upsert_notification(
            user_id=user_id,
            key="standup_followup",
            type_="standup",
            title="💬 Manager Follow-up on Your Standup",
            body=followup,
            icon="🤖",
            href="/dashboard/standup",
        )

    # Consistency warning notification
    if not analysis.get("consistency_ok") and prior_today:
        upsert_notification(
            user_id=user_id,
            key="standup_consistency",
            type_="standup",
            title="⚠️ Standup Inconsistency Detected",
            body=analysis.get("consistency_note") or
                 f"You said you'd '{prior_today[:80]}' yesterday, but today's 'Yesterday' doesn't match.",
            icon="⚠️",
            href="/dashboard/standup",
        )

    return {
        "ok":            True,
        "standup_id":    standup_id,
        "is_late":       is_late,
        "analysis":      analysis,
        "blocker_count": len(blocker_records),
    }


async def _escalate_blockers(
    blocker_records: list[dict],
    reporter_name: str,
    group_id: str,
    standup_id: str,
):
    """Notify tagged role members about a blocker."""
    try:
        members_res = (
            supabase_admin.table("group_members")   # ← correct table
            .select("user_id, intern_role")
            .eq("group_id", group_id)               # ← correct column
            .execute()
        )
        members = members_res.data or []

        for blocker in blocker_records:
            tagged_role = blocker.get("tagged_role")
            if not tagged_role:
                continue

            targets = [m for m in members if m.get("intern_role") == tagged_role]
            for target in targets:
                upsert_notification(
                    user_id=target["user_id"],
                    key=f"blocker_{standup_id}_{tagged_role}",
                    type_="standup",
                    title="🚨 Blocker Escalation — Action Required",
                    body=f"{reporter_name} is blocked: \"{blocker['blocker_text'][:100]}\" — You are tagged as responsible ({tagged_role}).",
                    icon="🚨",
                    href="/dashboard/standup",
                )
    except Exception as e:
        logger.error(f"_escalate_blockers failed: {e}", exc_info=True)


@router.get("/feed")
async def get_standup_feed(
    cohort_id:   Optional[str] = Query(None),
    group_id:    Optional[str] = Query(None),
    date_filter: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Team standup feed for a given date (default: today)."""
    target_date = date_filter or _today_ist().isoformat()
    user_id = current_user["id"]

    # Accept either param name from frontend
    resolved_group = group_id or cohort_id
    resolved_group = _resolve_group_id(user_id, resolved_group)

    if not resolved_group:
        return {
            "standups": [], "missing": [], "date": target_date,
            "summary": None, "total_members": 0, "submitted_count": 0,
            "window": _standup_window_status(),
        }

    # Standup submissions for this group + date
    standups_res = (
        supabase_admin.table("standups")
        .select("*, profiles:user_id(id, name, avatar_url, intern_role)")
        .eq("group_id", resolved_group)             # ← correct column
        .eq("date", target_date)
        .order("submitted_at", desc=False)
        .execute()
    )
    standups = standups_res.data or []

    # All group members
    members_res = (
        supabase_admin.table("group_members")        # ← correct table
        .select("user_id, intern_role, profiles:user_id(id, name, avatar_url, intern_role)")
        .eq("group_id", resolved_group)             # ← correct column
        .execute()
    )
    all_members = members_res.data or []
    submitted_ids = {s["user_id"] for s in standups}

    missing = [
        {
            "user_id": m["user_id"],
            "role":    m.get("intern_role"),
            "profile": m.get("profiles"),
        }
        for m in all_members
        if m["user_id"] not in submitted_ids
    ]

    # Blocker details for each standup
    standup_ids = [s["id"] for s in standups]
    blocker_map: dict[str, list] = {}
    if standup_ids:
        try:
            b_res = (
                supabase_admin.table("standup_blocker_escalations")
                .select("*")
                .in_("standup_id", standup_ids)
                .execute()
            )
            for b in (b_res.data or []):
                blocker_map.setdefault(b["standup_id"], []).append(b)
        except Exception:
            pass

    for s in standups:
        s["blocker_list"] = blocker_map.get(s["id"], [])

    # Today's AI summary
    summary_res = (
        supabase_admin.table("standup_summaries")
        .select("*")
        .eq("group_id", resolved_group)             # ← correct column
        .eq("date", target_date)
        .limit(1)
        .execute()
    )
    summary = summary_res.data[0] if summary_res.data else None

    return {
        "standups":       standups,
        "missing":        missing,
        "date":           target_date,
        "summary":        summary,
        "window":         _standup_window_status(),
        "total_members":  len(all_members),
        "submitted_count": len(standups),
    }


@router.get("/my-history")
async def get_my_history(
    limit: int = Query(14, le=30),
    current_user: dict = Depends(get_current_user),
):
    """Get the current user's standup history."""
    res = (
        supabase_admin.table("standups")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("date", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


@router.get("/summary")
async def get_summary(
    cohort_id:   Optional[str] = Query(None),
    group_id:    Optional[str] = Query(None),
    date_filter: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Get today's AI Scrum Master summary for the group."""
    target_date = date_filter or _today_ist().isoformat()
    user_id = current_user["id"]

    resolved_group = group_id or cohort_id
    resolved_group = _resolve_group_id(user_id, resolved_group)

    if not resolved_group:
        raise HTTPException(404, "No active group found")

    summary_res = (
        supabase_admin.table("standup_summaries")
        .select("*")
        .eq("group_id", resolved_group)
        .eq("date", target_date)
        .limit(1)
        .execute()
    )

    if not summary_res.data:
        raise HTTPException(404, "Summary not yet generated for today")

    return summary_res.data[0]


@router.post("/trigger-summary")
async def trigger_summary(
    cohort_id:     Optional[str] = Query(None),
    group_id:      Optional[str] = Query(None),
    date_override: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Trigger AI Scrum Master summary generation via Groq."""
    user_id = current_user["id"]
    target_date = date_override or _today_ist().isoformat()

    resolved_group = group_id or cohort_id
    resolved_group = _resolve_group_id(user_id, resolved_group)

    if not resolved_group:
        raise HTTPException(400, "group_id required or user must be in an active group")

    # Check existing summary
    existing_res = (
        supabase_admin.table("standup_summaries")
        .select("id")
        .eq("group_id", resolved_group)
        .eq("date", target_date)
        .limit(1)
        .execute()
    )
    if existing_res.data and current_user.get("role") not in ("mentor", "admin"):
        return {"ok": True, "message": "Summary already generated", "regenerated": False}

    # Fetch submissions
    standups_res = (
        supabase_admin.table("standups")
        .select("*, profiles:user_id(id, name, avatar_url, intern_role)")
        .eq("group_id", resolved_group)
        .eq("date", target_date)
        .execute()
    )
    submitted = standups_res.data or []

    # Fetch all group members
    members_res = (
        supabase_admin.table("group_members")
        .select("user_id, intern_role, profiles:user_id(id, name, intern_role)")
        .eq("group_id", resolved_group)
        .execute()
    )
    all_members = members_res.data or []
    submitted_ids = {s["user_id"] for s in submitted}

    # Build standup_data for AI
    standup_data: list[dict] = []
    for s in submitted:
        profile = s.get("profiles") or {}
        standup_data.append({
            "name":       profile.get("name", "Unknown"),
            "role":       profile.get("intern_role", "intern"),
            "yesterday":  s.get("yesterday", ""),
            "today":      s.get("today", ""),
            "blockers":   s.get("blockers", ""),
            "eta_hours":  s.get("eta_hours"),
            "is_late":    s.get("is_late", False),
            "vague_score": s.get("vague_score", 0),
            "missed":     False,
        })

    for m in all_members:
        if m["user_id"] not in submitted_ids:
            profile = m.get("profiles") or {}
            standup_data.append({
                "name":   profile.get("name", "Unknown"),
                "role":   m.get("intern_role", "intern"),
                "missed": True,
            })

    # Generate AI summary + manager notes via Groq
    scrum_result  = await generate_scrum_summary(standup_data, target_date)
    manager_notes = await generate_manager_notes(standup_data)

    now_iso = datetime.now(timezone.utc).isoformat()
    summary_row = {
        "group_id":        resolved_group,           # ← correct column
        "date":            target_date,
        "summary_text":    scrum_result.get("summary_text", ""),
        "sprint_risk":     scrum_result.get("sprint_risk", "medium"),
        "blocker_count":   sum(1 for s in submitted if s.get("blockers")),
        "late_count":      sum(1 for s in submitted if s.get("is_late")),
        "missed_count":    len(all_members) - len(submitted),
        "submission_count": len(submitted),
        "manager_notes":   manager_notes,
        "generated_at":    now_iso,
    }

    if existing_res.data:
        supabase_admin.table("standup_summaries").update(summary_row)\
            .eq("group_id", resolved_group).eq("date", target_date).execute()
    else:
        summary_row["id"] = str(uuid.uuid4())
        supabase_admin.table("standup_summaries").insert(summary_row).execute()

    # Notify all group members
    risk = scrum_result.get("sprint_risk", "medium")
    risk_emoji = {"low": "🟢", "medium": "🟡", "high": "🔴", "critical": "🚨"}.get(risk, "🟡")
    for m in all_members:
        upsert_notification(
            user_id=m["user_id"],
            key=f"standup_summary_{target_date}",
            type_="standup",
            title=f"{risk_emoji} Standup Summary — Sprint Risk: {risk.upper()}",
            body=scrum_result.get("summary_text", "")[:200],
            icon="📋",
            href="/dashboard/standup",
        )

    return {
        "ok":           True,
        "regenerated":  bool(existing_res.data),
        "sprint_risk":  risk,
        "summary":      scrum_result.get("summary_text"),
        "manager_notes": manager_notes,
    }


@router.get("/consistency-check")
async def consistency_check(current_user: dict = Depends(get_current_user)):
    """Check if yesterday's 'today' plan matches today's 'yesterday' report."""
    user_id   = current_user["id"]
    today     = _today_ist()
    yesterday = (today - timedelta(days=1)).isoformat()
    today_str = today.isoformat()

    yesterday_standup = (
        supabase_admin.table("standups")
        .select("today, date")
        .eq("user_id", user_id)
        .eq("date", yesterday)
        .limit(1)
        .execute()
    )
    today_standup = (
        supabase_admin.table("standups")
        .select("yesterday, consistency_ok, ai_followup, date")
        .eq("user_id", user_id)
        .eq("date", today_str)
        .limit(1)
        .execute()
    )

    prior       = yesterday_standup.data[0] if yesterday_standup.data else None
    current_sub = today_standup.data[0] if today_standup.data else None

    return {
        "prior_plan":      prior["today"] if prior else None,
        "today_report":    current_sub["yesterday"] if current_sub else None,
        "consistency_ok":  current_sub.get("consistency_ok") if current_sub else None,
        "ai_followup":     current_sub.get("ai_followup") if current_sub else None,
        "submitted_today": current_sub is not None,
    }


@router.post("/reply-to-manager")
async def reply_to_manager(
    body: ManagerReply,
    current_user: dict = Depends(get_current_user),
):
    """
    Intern sends a reply to the AI manager's follow-up question.
    The AI manager responds back in context, continuing the thread.
    Full thread history is saved to the standup row.
    """
    user_id = current_user["id"]

    # Verify ownership — fetch full context so AI knows WHY the follow-up was triggered
    standup_res = (
        supabase_admin.table("standups")
        .select("id, user_id, yesterday, today, blockers, ai_followup, thread_history, consistency_ok, vague_score, consistency_note, prior_today")
        .eq("id", body.standup_id)
        .limit(1)
        .execute()
    )
    if not standup_res.data:
        raise HTTPException(404, "Standup not found")

    standup = standup_res.data[0]
    if standup["user_id"] != user_id:
        raise HTTPException(403, "You can only reply to your own standup")

    if not standup.get("ai_followup"):
        raise HTTPException(400, "This standup has no manager question to reply to")

    reply_text = body.reply.strip()
    if len(reply_text) < 3:
        raise HTTPException(400, "Reply is too short")
    if len(reply_text) > 1000:
        raise HTTPException(400, "Reply is too long (max 1000 characters)")

    # Generate AI manager response using full thread context
    from app.services.standup_ai import generate_manager_thread_reply
    ai_response = await generate_manager_thread_reply(
        standup=standup,
        thread_history=body.thread_history,
        intern_reply=reply_text,
        intern_name=current_user.get("name", "intern"),
        intern_role=current_user.get("intern_role", "intern"),
    )

    # Build updated thread: prior history + intern reply + new AI response
    updated_thread = list(body.thread_history) + [
        {"role": "intern",  "text": reply_text},
        {"role": "manager", "text": ai_response},
    ]

    # Persist full thread to DB
    supabase_admin.table("standups").update({
        "thread_history":   updated_thread,
        "manager_reply":    reply_text,       # last intern reply (legacy compat)
        "manager_reply_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", body.standup_id).execute()

    return {
        "ok":          True,
        "ai_response": ai_response,
        "thread":      updated_thread,
    }