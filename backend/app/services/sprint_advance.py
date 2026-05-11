"""
backend/app/services/sprint_advance.py
───────────────────────────────────────
Backward-compatible shim.

The old monolithic sprint-advance logic (single adaptive sprint per intern per
project, computed after "Sprint 1 done") has been superseded by the pool-based
adaptive engine in app/services/adaptive_engine.py.

This file is kept so that any code still importing from here continues to work.
All real logic is now in adaptive_engine.py.

What changed:
  OLD model:  1 initial sprint → all tasks assigned upfront → engine kicks in
              only when ALL Sprint-1 tasks done → assigns 1 of 3 fixed adaptive
              sprints (easy/medium/hard) with pre-seeded tasks.

  NEW model:  Per-role sprint track (Sprint 0, Sprint 1, Sprint 2 …).
              Each sprint has a task pool: ceil(members × 3.5) tasks split
              43% easy | 43% medium | 14% hard, left UNASSIGNED.
              On join → intern gets 2 initial tasks (1 easy + 1 medium).
              On task done + todo list empty → engine scores performance and
              drips the next pool task matching the computed tier.
              On pool exhausted → engine advances to the next sprint number.
"""

import logging
from datetime import datetime, timezone

from app.core.database import supabase_admin
from app.routers.notifications import upsert_notification

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Kept for any direct callers ────────────────────────────────────────────────

def check_all_tasks_done(user_id: str, sprint_id: str) -> bool:
    """
    Return True if every task assigned to this user in this sprint is 'done'.
    Kept for backward compatibility; new code should call adaptive_engine.on_task_done.
    """
    try:
        result = (
            supabase_admin.table("tasks")
            .select("id, status")
            .eq("assigned_to", user_id)
            .eq("sprint_id", sprint_id)
            .execute()
        )
        tasks = result.data or []
        if not tasks:
            return False
        return all(t["status"] == "done" for t in tasks)
    except Exception as e:
        logger.error(f"check_all_tasks_done failed user={user_id} sprint={sprint_id}: {e}")
        return False


def maybe_advance_sprint(user_id: str, sprint_id: str) -> dict:
    """
    Backward-compatible entry point.

    Delegates to adaptive_engine.on_task_done which handles both
    mid-sprint task assignment and cross-sprint advancement.
    """
    try:
        from app.services.adaptive_engine import on_task_done

        # We need a task_id to call on_task_done. Find the most recently
        # completed task for this user in this sprint.
        result = (
            supabase_admin.table("tasks")
            .select("id")
            .eq("assigned_to", user_id)
            .eq("sprint_id", sprint_id)
            .eq("status", "done")
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return {"advanced": False, "reason": "No completed tasks found."}

        task_id = result.data[0]["id"]
        outcome = on_task_done(user_id=user_id, task_id=task_id)

        # Translate new format → old format for any callers that check "advanced"
        action = outcome.get("action", "none")
        return {
            "advanced":         action == "sprint_advanced",
            "new_sprint_id":    outcome.get("new_sprint_id"),
            "new_sprint_title": outcome.get("new_sprint_title"),
            "tier":             outcome.get("difficulty"),
            "reason":           outcome.get("reason", ""),
        }
    except Exception as e:
        logger.error(f"maybe_advance_sprint failed user={user_id}: {e}", exc_info=True)
        return {"advanced": False, "reason": f"Error: {e}"}
