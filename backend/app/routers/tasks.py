from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.core.database import db

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


def _get_active_project_id(user_id: str) -> str | None:
    """
    Returns the user's currently active project_id.

    Lookup order:
      1. group_members → project_groups.project_id  (authoritative, multiplayer)
      2. profiles.project_id                         (set by /join as a fast cache)
    """
    # 1. Check group_members (the real membership table)
    result = (
        db.table("group_members")
        .select("project_groups(project_id)")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if result.data:
        pg = result.data[0].get("project_groups")
        if isinstance(pg, dict) and pg.get("project_id"):
            return pg["project_id"]

    # 2. Fallback to profiles.project_id
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


@router.get("/my-tasks")
async def get_my_tasks(current_user: dict = Depends(get_current_user)):
    user_id    = current_user["id"]
    project_id = _get_active_project_id(user_id)

    query = db.table("tasks").select("*").eq("assigned_to", user_id)
    if project_id:
        query = query.eq("project_id", project_id)

    result = query.execute()
    return result.data or []


@router.get("/project-tasks")
async def get_project_tasks(current_user: dict = Depends(get_current_user)):
    """All tasks for the current user's project — used by the Teammates page."""
    user_id    = current_user["id"]
    project_id = _get_active_project_id(user_id)

    if not project_id:
        return []

    result = (
        db.table("tasks")
        .select("id, title, description, status, priority, due_date, assigned_to, updated_at, created_at, score, feedback, github_pr_url, sprint_id")
        .eq("project_id", project_id)
        .execute()
    )
    return result.data or []


@router.get("/sprints/active")
async def get_active_sprint(current_user: dict = Depends(get_current_user)):
    user_id    = current_user["id"]
    project_id = _get_active_project_id(user_id)

    if project_id:
        result = (
            db.table("sprints")
            .select("*")
            .eq("project_id", project_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        return result.data or []

    return []


@router.get("/active-task")
async def get_active_task(current_user: dict = Depends(get_current_user)):
    user_id    = current_user["id"]
    project_id = _get_active_project_id(user_id)

    query = (
        db.table("tasks")
        .select("id, title, status")
        .eq("assigned_to", user_id)
        .eq("status", "in_progress")
    )
    if project_id:
        query = query.eq("project_id", project_id)

    result = query.order("created_at", desc=True).limit(1).execute()
    if not result.data:
        return {"task_id": None, "title": None}
    return {"task_id": result.data[0]["id"], "title": result.data[0]["title"]}


@router.get("/{task_id}")
async def get_task(task_id: str, current_user: dict = Depends(get_current_user)):
    result = db.table("tasks").select("*").eq("id", task_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return result.data[0]


@router.patch("/{task_id}/status")
async def update_task_status(task_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    valid_statuses = ["todo", "in_progress", "review", "done"]
    status = body.get("status")
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    result = db.table("tasks").update({"status": status}).eq("id", task_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return result.data[0]


@router.patch("/{task_id}")
async def update_task(task_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    allowed = {"title", "description", "status", "priority", "due_date", "resources", "github_pr_url"}
    update_data = {k: v for k, v in body.items() if k in allowed}
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    result = db.table("tasks").update(update_data).eq("id", task_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return result.data[0]