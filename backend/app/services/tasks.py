from fastapi import HTTPException
from app.core.database import db

# ── STATE MACHINE ────────────────────────────────────────────────────────────
# Defines which status transitions are allowed.
# Key = current status, Value = list of statuses it can move to.
# This prevents an intern from skipping "review" and going straight to "done".

ALLOWED_TRANSITIONS = {
    "todo":        ["in_progress"],
    "in_progress": ["todo", "review"],
    "review":      ["in_progress", "done"],
    "done":        [],   # terminal state — nothing can come after done
}


def validate_transition(current: str, new: str) -> None:
    """
    Called before every status update.
    Raises 400 Bad Request if the transition is not allowed.
    """
    allowed = ALLOWED_TRANSITIONS.get(current, [])
    if new not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move task from '{current}' to '{new}'. "
                   f"Allowed transitions: {allowed}"
        )


def get_task_or_404(task_id: str) -> dict:
    """Fetch a task by ID or raise 404 if not found."""
    result = db.table("tasks").select("*").eq("id", task_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return result.data


def get_sprint_or_404(sprint_id: str) -> dict:
    """Fetch a sprint by ID or raise 404 if not found."""
    result = db.table("sprints").select("*").eq("id", sprint_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return result.data


def assert_task_owner(task: dict, user_id: str) -> None:
    """
    Ensures an intern can only update their OWN tasks.
    Raises 403 Forbidden if they try to modify someone else's task.
    """
    if task["assigned_to"] != user_id:
        raise HTTPException(
            status_code=403,
            detail="You can only modify tasks assigned to you"
        )


def calculate_sprint_progress(sprint_id: str) -> dict:
    """
    Calculates completion stats for a sprint.
    Returns counts per status + completion percentage + average score.
    """
    result = db.table("tasks").select("status, score").eq("sprint_id", sprint_id).execute()
    tasks  = result.data or []

    if not tasks:
        return {
            "sprint_id":       sprint_id,
            "total_tasks":     0,
            "todo":            0,
            "in_progress":     0,
            "review":          0,
            "done":            0,
            "completion_rate": 0.0,
            "average_score":   None,
        }

    counts = {"todo": 0, "in_progress": 0, "review": 0, "done": 0}
    scores = []

    for task in tasks:
        status = task.get("status", "todo")
        if status in counts:
            counts[status] += 1
        if task.get("score") is not None:
            scores.append(task["score"])

    total           = len(tasks)
    completion_rate = round((counts["done"] / total) * 100, 1) if total > 0 else 0.0
    average_score   = round(sum(scores) / len(scores), 1) if scores else None

    return {
        "sprint_id":       sprint_id,
        "total_tasks":     total,
        "completion_rate": completion_rate,
        "average_score":   average_score,
        **counts,
    }
