"""
backend/app/routers/mid_sprint_change.py
─────────────────────────────────────────
Router for mid-sprint requirement change simulation.

Endpoints:
  POST /api/mid-sprint-change/trigger
    Called automatically when a task is marked as "done".
    Schedules a background task that waits 5–10 min then applies a change.

  GET  /api/mid-sprint-change/status/{sprint_id}
    Returns whether a mid-sprint change has been applied in the current sprint.

  POST /api/mid-sprint-change/force-trigger (dev/debug only)
    Immediately triggers a mid-sprint change without the delay — useful for testing.

FIXES in this version:
──────────────────────
  FIX 1 — _get_active_sprint_for_user used a nested PostgREST join:
           .select("project_groups(project_id)")
           This crashes the Cloudflare worker with Error 1101 "Worker threw exception".
           Replaced with two flat queries (group_members → project_groups) matching
           the fix already applied in tasks.py and adaptive_engine.py.

  FIX 2 — /trigger endpoint uses _delayed_change_job (async) instead of the
           sync wrapper. FastAPI's BackgroundTasks runs in a thread executor so
           the async coroutine is never awaited. Kept the async version for
           backwards-compat but the endpoint now uses _delayed_change_job_sync.
"""

import asyncio
import random
import logging
import time as _time
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from pydantic import BaseModel
from app.core.auth import get_current_user
from app.core.database import supabase_admin
from app.services.mid_sprint_change import check_and_trigger_mid_sprint_change

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/mid-sprint-change", tags=["Mid-Sprint Change"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_user_role(user_id: str) -> str:
    """Fetch the intern's role from group_members or profiles."""
    try:
        gm = (
            supabase_admin.table("group_members")
            .select("intern_role")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if gm.data and gm.data[0].get("intern_role"):
            return gm.data[0]["intern_role"]
    except Exception:
        pass

    try:
        profile = (
            supabase_admin.table("profiles")
            .select("intern_role")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if profile.data and profile.data[0].get("intern_role"):
            return profile.data[0]["intern_role"]
    except Exception:
        pass

    return "default"


def _get_active_sprint_for_user(user_id: str) -> str | None:
    """
    Get the active sprint ID for the user's current project.

    FIX: Old code used a nested PostgREST join:
         .select("project_groups(project_id)")
    This crashes the Supabase/Cloudflare worker with Error 1101.
    Now uses two flat queries: group_members → project_groups.
    """
    try:
        # Step 1: get group_id from group_members (flat query)
        gm = (
            supabase_admin.table("group_members")
            .select("group_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        project_id = None

        if gm.data and gm.data[0].get("group_id"):
            group_id = gm.data[0]["group_id"]
            # Step 2: get project_id from project_groups (flat query)
            pg = (
                supabase_admin.table("project_groups")
                .select("project_id")
                .eq("id", group_id)
                .limit(1)
                .execute()
            )
            if pg.data:
                project_id = pg.data[0].get("project_id")

        # Fallback: profiles.project_id
        if not project_id:
            profile = (
                supabase_admin.table("profiles")
                .select("project_id")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            if profile.data:
                project_id = profile.data[0].get("project_id")

        if not project_id:
            return None

        # Step 3: find active sprint for the project
        sprint = (
            supabase_admin.table("sprints")
            .select("id")
            .eq("project_id", project_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if sprint.data:
            return sprint.data[0]["id"]

    except Exception as e:
        logger.error(f"_get_active_sprint_for_user failed user={user_id}: {e}")
    return None


# ─── Background Jobs ──────────────────────────────────────────────────────────

async def _delayed_change_job(user_id: str, sprint_id: str, role: str, delay_seconds: int):
    """
    Async background job — kept for backwards compatibility only.
    Do NOT use with FastAPI BackgroundTasks (thread executor won't await it).
    Use _delayed_change_job_sync instead.
    """
    try:
        logger.info(
            f"[MidSprintChange] Scheduled (async) for user={user_id} sprint={sprint_id} "
            f"role={role} delay={delay_seconds}s"
        )
        await asyncio.sleep(delay_seconds)

        result = check_and_trigger_mid_sprint_change(user_id, sprint_id, role)
        if result["triggered"]:
            logger.info(
                f"[MidSprintChange] ✅ Applied to task={result['task_id']} "
                f"user={user_id}"
            )
        else:
            logger.info(
                f"[MidSprintChange] ⏭ Skipped for user={user_id}: {result['reason']}"
            )
    except Exception as e:
        logger.error(f"[MidSprintChange] Background job failed user={user_id}: {e}", exc_info=True)


def _delayed_change_job_sync(user_id: str, sprint_id: str, role: str, delay_seconds: int):
    """
    SYNC background job — use this with FastAPI BackgroundTasks.

    FastAPI's BackgroundTasks runs jobs in a thread executor. Passing an async
    coroutine to add_task() causes the thread to return a coroutine object
    without awaiting it — the job silently does nothing. This sync wrapper uses
    time.sleep() so it executes correctly in a thread.

    Also re-fetches the active sprint_id at execution time rather than using
    the sprint_id captured at scheduling time. If the sprint advanced between
    scheduling and execution, the original sprint_id would point to a
    deactivated sprint.
    """
    try:
        logger.info(
            f"[MidSprintChange] Sleeping {delay_seconds}s for user={user_id} sprint={sprint_id}"
        )
        _time.sleep(delay_seconds)

        # Re-resolve the active sprint at execution time
        live_sprint_id = _get_active_sprint_for_user(user_id) or sprint_id

        result = check_and_trigger_mid_sprint_change(user_id, live_sprint_id, role)
        if result["triggered"]:
            logger.info(
                f"[MidSprintChange] ✅ Applied to task={result['task_id']} "
                f"user={user_id} sprint={live_sprint_id}"
            )
        else:
            logger.info(
                f"[MidSprintChange] ⏭ Skipped for user={user_id}: {result['reason']}"
            )
    except Exception as e:
        logger.error(f"[MidSprintChange] Sync background job failed user={user_id}: {e}", exc_info=True)


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class TriggerBody(BaseModel):
    task_id: str
    sprint_id: str | None = None


class ForceBody(BaseModel):
    sprint_id: str | None = None


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/trigger")
async def trigger_mid_sprint_change(
    body: TriggerBody,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """
    Schedule a mid-sprint change check after a random delay of 5–10 minutes.
    Call this when an intern marks a task as "done".
    """
    user_id = current_user["id"]
    role = _get_user_role(user_id)

    sprint_id = body.sprint_id or _get_active_sprint_for_user(user_id)
    if not sprint_id:
        return {
            "scheduled": False,
            "reason": "No active sprint found for user.",
        }

    delay = random.randint(300, 600)

    # FIX: use _delayed_change_job_SYNC — not the async version.
    # FastAPI BackgroundTasks runs in a thread; async coroutines are never awaited.
    background_tasks.add_task(
        _delayed_change_job_sync,
        user_id=user_id,
        sprint_id=sprint_id,
        role=role,
        delay_seconds=delay,
    )

    logger.info(
        f"[MidSprintChange] Scheduled for user={user_id} sprint={sprint_id} "
        f"role={role} delay={delay}s (~{delay//60}min)"
    )

    return {
        "scheduled": True,
        "delay_seconds": delay,
        "sprint_id": sprint_id,
        "role": role,
        "message": f"Mid-sprint change check scheduled in ~{delay//60} minutes.",
    }


@router.get("/status/{sprint_id}")
async def get_mid_sprint_status(
    sprint_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Returns whether a mid-sprint change has already been applied for this
    intern in the given sprint, and details of the changed task if so.
    """
    user_id = current_user["id"]

    try:
        result = (
            supabase_admin.table("tasks")
            .select("id, title, status, mid_sprint_changed, mid_sprint_change_reason, mid_sprint_changed_at")
            .eq("assigned_to", user_id)
            .eq("sprint_id", sprint_id)
            .eq("mid_sprint_changed", True)
            .execute()
        )
        changed_tasks = result.data or []

        return {
            "sprint_id": sprint_id,
            "has_mid_sprint_change": len(changed_tasks) > 0,
            "changed_tasks": changed_tasks,
        }
    except Exception as e:
        logger.error(f"get_mid_sprint_status failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch mid-sprint status")


@router.post("/force-trigger")
async def force_trigger_change(
    body: ForceBody,
    current_user: dict = Depends(get_current_user),
):
    """
    Immediately apply a mid-sprint change without any delay.
    Useful for testing/demo — should be disabled or guarded in production.
    """
    user_id = current_user["id"]
    role = _get_user_role(user_id)

    sprint_id = body.sprint_id or _get_active_sprint_for_user(user_id)
    if not sprint_id:
        raise HTTPException(status_code=400, detail="No active sprint found for user.")

    result = check_and_trigger_mid_sprint_change(user_id, sprint_id, role)
    return result