"""
backend/app/routers/adaptive.py
================================
Adaptive Difficulty Engine — API layer for the pool-based sprint system.

Architecture recap (matches adaptive_engine.py):
  Project
  └── Per-role sprint track:  Sprint 0 → Sprint 1 → Sprint 2 …
        Each sprint is scoped to (project_id, group_id, intern_role).
        Pool size = ceil(member_count × 3.5), split ~43% easy / ~43% medium / ~14% hard.
        Initial assignment: 1 easy + 1 medium per intern.
        Mid-sprint: next pool task assigned (difficulty-matched) when intern's todo list empties.
        Sprint advance: whole TEAM (same project + group + role) advances together when all
                        their assigned tasks are 'done'.

Endpoints:
  GET  /api/adaptive/progress      — intern's current sprint state & tasks
  GET  /api/adaptive/score         — computed performance score + breakdown
  GET  /api/adaptive/sprint-tasks  — tasks for current active sprint + pool stats
  GET  /api/adaptive/status        — diagnostic: are you healthy or do you need recovery?
  POST /api/adaptive/initialise    — set up Sprint 0 for a newly-joined intern
  POST /api/adaptive/recover       — fix broken state (no sprint / no tasks)
  POST /api/adaptive/trigger       — manually trigger on_task_done (debug / admin)

FIXES in this version:
──────────────────────
  FIX 1 — _get_active_sprint_for_user used .ilike("title", f"%{role_title}%")
           which crashes this Supabase/Cloudflare instance with Error 1101
           "Worker threw exception". Replaced with a flat fetch of all active
           sprints for the project + group, then Python-side substring match
           on the title. Matches the same fix applied in tasks.py.

  FIX 2 — Removed hardcoded TIER_SPRINT_MAP UUIDs — the new engine creates
           dynamic sprints.

  FIX 3 — Removed _get_sprint1_id nested PostgREST join
           (.select("sprint_id, sprints(id, start_date)")) — now flat two-step
           queries only.

  FIX 4 — Removed adaptive_sprint_assignments table references — the new
           engine doesn't use it.

  FIX 5 — _get_project_id — removed nested join (.select("project_groups(project_id)")).
           Now uses two flat queries matching the fix in auth.py and tasks.py.

  FIX 6 — Added GET /api/adaptive/status (diagnostic) and
           POST /api/adaptive/recover (self-healing endpoint for the
           "6 tasks + no active sprint" state). These two endpoints let the
           frontend detect and fix broken intern states without a support call.

All sprint fetches are flat selects on the sprints table directly.
"""

from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user
from app.core.database import db

router = APIRouter(prefix="/api/adaptive", tags=["Adaptive Difficulty"])


# ── Helpers (all flat queries — no nested PostgREST joins, no .ilike()) ───────

def _get_project_id(user_id: str) -> str | None:
    """
    Return the intern's active project_id.

    FIX: Old code used .select("project_groups(project_id)") — nested join that
    crashes the Cloudflare worker with Error 1101. Now uses two flat queries.
    """
    gm = (
        db.table("group_members")
        .select("group_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if gm.data and gm.data[0].get("group_id"):
        group_id = gm.data[0]["group_id"]
        pg = (
            db.table("project_groups")
            .select("project_id")
            .eq("id", group_id)
            .limit(1)
            .execute()
        )
        if pg.data and pg.data[0].get("project_id"):
            return pg.data[0]["project_id"]

    profile = (
        db.table("profiles")
        .select("project_id")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if profile.data and profile.data[0].get("project_id"):
        return profile.data[0]["project_id"]
    return None


def _get_user_context(user_id: str) -> dict:
    """
    Return {project_id, group_id, intern_role} for the user.
    Flat queries only — no nested PostgREST selects.
    """
    gm = (
        db.table("group_members")
        .select("group_id, intern_role")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if gm.data:
        row = gm.data[0]
        group_id = row.get("group_id")
        intern_role = row.get("intern_role")
        project_id = None
        if group_id:
            pg = (
                db.table("project_groups")
                .select("project_id")
                .eq("id", group_id)
                .limit(1)
                .execute()
            )
            if pg.data:
                project_id = pg.data[0].get("project_id")
        if project_id:
            return {"project_id": project_id, "group_id": group_id, "intern_role": intern_role}

    prof = (
        db.table("profiles")
        .select("project_id, intern_role")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if prof.data:
        return {
            "project_id": prof.data[0].get("project_id"),
            "group_id": None,
            "intern_role": prof.data[0].get("intern_role"),
        }
    return {"project_id": None, "group_id": None, "intern_role": None}


def _get_active_sprint_for_user(
    user_id: str,
    project_id: str,
    group_id: str | None,
    intern_role: str | None,
) -> dict | None:
    """
    Find the active sprint for this user's team (project + group + role).
    Flat queries — no nested PostgREST joins, NO .ilike().

    Strategy:
      1. Find sprint_ids from user's non-done tasks in this project → fetch active sprint row.
      2. Fetch all active sprints for project+group, filter by role title in Python.
         FIX: was using .ilike("title", ...) which crashes Cloudflare with Error 1101.
      3. Final fallback: first active sprint for the project.
    """
    # Step 1: sprint_ids from user's active tasks (most reliable)
    task_res = (
        db.table("tasks")
        .select("sprint_id")
        .eq("assigned_to", user_id)
        .eq("project_id", project_id)
        .neq("status", "done")
        .not_.is_("sprint_id", "null")
        .execute()
    )
    sprint_ids = list({
        row["sprint_id"]
        for row in (task_res.data or [])
        if row.get("sprint_id")
    })

    if sprint_ids:
        sprint_res = (
            db.table("sprints")
            .select("*")
            .in_("id", sprint_ids)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if sprint_res.data:
            return sprint_res.data[0]

    # Step 2: fetch all active sprints for project+group, filter by role in Python
    # FIX: NO .ilike() — fetch all and filter with str.lower() substring match.
    if intern_role:
        query = (
            db.table("sprints")
            .select("*")
            .eq("project_id", project_id)
            .eq("is_active", True)
        )
        if group_id:
            query = query.eq("group_id", group_id)
        all_active = query.execute().data or []

        role_needle = intern_role.replace("_", " ").lower()

        # Priority 1: group-scoped + role title match
        if group_id:
            for s in all_active:
                if role_needle in (s.get("title") or "").lower() and s.get("group_id") == group_id:
                    return s

        # Priority 2: project-wide role title match
        for s in all_active:
            if role_needle in (s.get("title") or "").lower():
                return s

        # Priority 3: any active sprint in the filtered set
        if all_active:
            return all_active[0]

    # Step 3: absolute fallback — any active sprint in the project
    res = (
        db.table("sprints")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _get_all_user_sprints(user_id: str, project_id: str) -> list[dict]:
    """
    Return all sprint records the user has tasks in, ordered by sprint number.
    Flat queries only.
    """
    task_res = (
        db.table("tasks")
        .select("sprint_id")
        .eq("assigned_to", user_id)
        .eq("project_id", project_id)
        .not_.is_("sprint_id", "null")
        .execute()
    )
    sprint_ids = list({
        row["sprint_id"]
        for row in (task_res.data or [])
        if row.get("sprint_id")
    })

    if not sprint_ids:
        return []

    sprint_res = (
        db.table("sprints")
        .select("*")
        .in_("id", sprint_ids)
        .order("start_date")
        .execute()
    )
    return sprint_res.data or []


def _get_sprint_tasks(user_id: str, sprint_id: str) -> list[dict]:
    res = (
        db.table("tasks")
        .select("id, title, description, status, priority, due_date, difficulty, score, feedback, task_doc, resources, github_pr_url")
        .eq("sprint_id", sprint_id)
        .eq("assigned_to", user_id)
        .execute()
    )
    return res.data or []


def _sprint_task_summary(tasks: list[dict]) -> dict:
    total = len(tasks)
    done = sum(1 for t in tasks if t.get("status") == "done")
    return {"total": total, "done": done, "pending": total - done}


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/progress")
async def get_progress(current_user: dict = Depends(get_current_user)):
    """
    Returns the intern's current sprint state:
      - active sprint info (title, sprint number, difficulty breakdown)
      - tasks for the active sprint
      - completed past sprints summary
      - performance score from the active sprint
    """
    user_id = current_user["id"]
    ctx = _get_user_context(user_id)
    project_id = ctx["project_id"]
    group_id = ctx["group_id"]
    intern_role = ctx["intern_role"]

    if not project_id:
        raise HTTPException(status_code=404, detail="No active project found.")

    active_sprint = _get_active_sprint_for_user(user_id, project_id, group_id, intern_role)
    all_sprints = _get_all_user_sprints(user_id, project_id)

    active_tasks = []
    task_summary = {"total": 0, "done": 0, "pending": 0}
    perf = None

    if active_sprint:
        active_tasks = _get_sprint_tasks(user_id, active_sprint["id"])
        task_summary = _sprint_task_summary(active_tasks)

        try:
            from app.services.adaptive_engine import compute_performance_score
            perf = compute_performance_score(user_id, active_sprint["id"])
        except Exception:
            perf = None

    past_sprints = []
    for s in all_sprints:
        if active_sprint and s["id"] == active_sprint["id"]:
            continue
        tasks = _get_sprint_tasks(user_id, s["id"])
        past_sprints.append({
            "sprint": s,
            "summary": _sprint_task_summary(tasks),
        })

    return {
        "intern_role":    intern_role,
        "active_sprint":  active_sprint,
        "task_summary":   task_summary,
        "tasks":          active_tasks,
        "performance":    perf,
        "past_sprints":   past_sprints,
    }


@router.get("/score")
async def get_score(current_user: dict = Depends(get_current_user)):
    """
    Compute and return the performance score for the intern's current active sprint.

    Formula (from adaptive_engine.compute_performance_score):
      base         = avg PR score across completed tasks (0–100)
      time_bonus   = +10 if submitted before due_date, −5 if late (per task)
      resubmit_pen = −8 per extra PR attempt beyond the first (per task)
      final        = clamp(base + time_bonus − resubmit_pen, 0, 100)

    Tier:  0–40 → easy | 41–70 → medium | 71–100 → hard
    """
    user_id = current_user["id"]
    ctx = _get_user_context(user_id)
    project_id = ctx["project_id"]
    group_id = ctx["group_id"]
    intern_role = ctx["intern_role"]

    if not project_id:
        raise HTTPException(status_code=404, detail="No active project found.")

    active_sprint = _get_active_sprint_for_user(user_id, project_id, group_id, intern_role)
    if not active_sprint:
        raise HTTPException(status_code=404, detail="No active sprint found.")

    from app.services.adaptive_engine import compute_performance_score
    return compute_performance_score(user_id, active_sprint["id"])


@router.get("/sprint-tasks")
async def get_sprint_tasks_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Returns tasks for the current active sprint only.
    Includes pool stats: how many unassigned tasks remain in the pool.
    """
    user_id = current_user["id"]
    ctx = _get_user_context(user_id)
    project_id = ctx["project_id"]
    group_id = ctx["group_id"]
    intern_role = ctx["intern_role"]

    if not project_id:
        raise HTTPException(status_code=404, detail="No active project found.")

    active_sprint = _get_active_sprint_for_user(user_id, project_id, group_id, intern_role)
    if not active_sprint:
        raise HTTPException(status_code=404, detail="No active sprint found.")

    tasks = _get_sprint_tasks(user_id, active_sprint["id"])

    # Pool stats: unassigned tasks remaining for this intern's role
    pool_res = (
        db.table("tasks")
        .select("id, difficulty")
        .eq("sprint_id", active_sprint["id"])
        .eq("project_id", project_id)
        .eq("intern_role", intern_role)    # scoped to role — FIX: was project-wide
        .is_("assigned_to", "null")
        .execute()
    )
    pool_remaining = pool_res.data or []

    pool_by_difficulty = {"easy": 0, "medium": 0, "hard": 0}
    for t in pool_remaining:
        d = t.get("difficulty", "easy")
        if d in pool_by_difficulty:
            pool_by_difficulty[d] += 1

    return {
        "sprint":         active_sprint,
        "tasks":          tasks,
        "task_summary":   _sprint_task_summary(tasks),
        "pool_remaining": {
            "total": len(pool_remaining),
            "by_difficulty": pool_by_difficulty,
        },
    }


@router.get("/status")
async def get_adaptive_status(current_user: dict = Depends(get_current_user)):
    """
    Diagnostic endpoint — returns whether the intern's sprint/task state is healthy.

    Returns:
      healthy: true + sprint details   — everything is fine
      healthy: false + issue code      — something is broken, call POST /recover

    Issue codes:
      NO_PROJECT         — intern not assigned to any project yet
      NO_ROLE            — intern has no intern_role set
      NO_ACTIVE_SPRINT   — no active sprint found (need to recover)
      NO_TASKS_ASSIGNED  — active sprint exists but intern has 0 assigned tasks
    """
    user_id = current_user["id"]
    ctx = _get_user_context(user_id)
    project_id = ctx["project_id"]
    group_id = ctx["group_id"]
    intern_role = ctx["intern_role"]

    if not project_id:
        return {"healthy": False, "issue": "NO_PROJECT", "message": "Not assigned to a project yet."}

    if not intern_role:
        return {"healthy": False, "issue": "NO_ROLE", "message": "intern_role not set — contact your mentor."}

    active_sprint = _get_active_sprint_for_user(user_id, project_id, group_id, intern_role)

    if not active_sprint:
        return {
            "healthy": False,
            "issue":   "NO_ACTIVE_SPRINT",
            "message": "No active sprint found. Call POST /api/adaptive/recover to fix.",
            "project_id":  project_id,
            "group_id":    group_id,
            "intern_role": intern_role,
        }

    tasks = _get_sprint_tasks(user_id, active_sprint["id"])

    if not tasks:
        return {
            "healthy": False,
            "issue":   "NO_TASKS_ASSIGNED",
            "message": "Sprint is active but no tasks assigned. Call POST /api/adaptive/recover.",
            "sprint_id":    active_sprint["id"],
            "sprint_title": active_sprint["title"],
        }

    return {
        "healthy":      True,
        "sprint_id":    active_sprint["id"],
        "sprint_title": active_sprint["title"],
        "intern_role":  intern_role,
        "tasks_assigned": len(tasks),
        "task_summary": _sprint_task_summary(tasks),
    }


@router.post("/initialise")
async def initialise_sprint(current_user: dict = Depends(get_current_user)):
    """
    Initialise Sprint 0 for the current intern (idempotent).
    Called automatically on project join (via projects.py), but exposed here
    as a recovery endpoint if the initial call failed.

    Sets up:
      - Sprint 0 for the intern's role/group (creates if not exists)
      - Task pool: ceil(member_count × 3.5) tasks split easy/medium/hard
      - Initial assignment: 1 easy + 1 medium task to this intern
    """
    user_id = current_user["id"]
    ctx = _get_user_context(user_id)
    project_id = ctx["project_id"]
    group_id = ctx["group_id"]
    intern_role = ctx["intern_role"]

    if not project_id:
        raise HTTPException(status_code=404, detail="No active project found.")
    if not intern_role:
        raise HTTPException(status_code=400, detail="Intern role not set. Contact your mentor.")

    from app.services.adaptive_engine import initialise_sprint_for_intern
    sprint = initialise_sprint_for_intern(
        user_id=user_id,
        project_id=project_id,
        group_id=group_id,
        intern_role=intern_role,
    )

    if not sprint:
        raise HTTPException(status_code=500, detail="Sprint initialisation failed. Check server logs.")

    tasks = _get_sprint_tasks(user_id, sprint["id"])
    return {
        "message": f"Sprint '{sprint['title']}' initialised.",
        "sprint":  sprint,
        "tasks":   tasks,
    }


@router.post("/recover")
async def recover_sprint(current_user: dict = Depends(get_current_user)):
    """
    Self-healing endpoint for the "6 tasks + no active sprint" broken state.

    Detects which of four broken states the intern is in and fixes it:

      State A — No sprint exists at all → full initialise
      State B — Sprint exists but is_active=False → activate + assign tasks
      State C — Sprint active but intern has 0 tasks → rebuild pool + assign
      State D — Template tasks with sprint_id=NULL → handled by build_task_pool

    Safe to call multiple times — all operations are idempotent.
    Returns a description of what was detected and what action was taken.
    """
    user_id = current_user["id"]
    ctx = _get_user_context(user_id)
    project_id = ctx["project_id"]
    group_id = ctx["group_id"]
    intern_role = ctx["intern_role"]

    if not project_id:
        raise HTTPException(status_code=404, detail="No active project found.")
    if not intern_role:
        raise HTTPException(status_code=400, detail="Intern role not set. Contact your mentor.")

    from app.services.adaptive_engine import recover_intern_sprint
    result = recover_intern_sprint(
        user_id=user_id,
        project_id=project_id,
        group_id=group_id,
        intern_role=intern_role,
    )

    if result.get("status") == "failed":
        raise HTTPException(
            status_code=500,
            detail=f"Recovery failed: {result.get('action_taken')}. Check server logs.",
        )

    # Return current tasks after recovery
    tasks = []
    if result.get("sprint_id"):
        tasks = _get_sprint_tasks(user_id, result["sprint_id"])

    return {
        **result,
        "tasks": tasks,
        "tasks_count": len(tasks),
    }


@router.post("/trigger")
async def trigger_adaptive(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Manually trigger the adaptive engine's on_task_done logic for a given task.
    Useful for debugging or admin recovery when the background task silently failed.

    Body: { "task_id": "<uuid>" }
    """
    task_id = body.get("task_id")
    if not task_id:
        raise HTTPException(status_code=400, detail="task_id is required.")

    user_id = current_user["id"]

    task_res = (
        db.table("tasks")
        .select("id, assigned_to, status")
        .eq("id", task_id)
        .limit(1)
        .execute()
    )
    if not task_res.data:
        raise HTTPException(status_code=404, detail="Task not found.")
    task = task_res.data[0]
    if task.get("assigned_to") != user_id and current_user.get("role") not in ("mentor", "admin"):
        raise HTTPException(status_code=403, detail="Not your task.")
    if task.get("status") != "done":
        raise HTTPException(status_code=400, detail="Task must be marked 'done' first.")

    from app.services.adaptive_engine import on_task_done
    result = on_task_done(user_id=user_id, task_id=task_id)
    return result