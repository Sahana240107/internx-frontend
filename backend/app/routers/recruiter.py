"""
app/routers/recruiter.py

Recruiter-facing data endpoints.
Uses the Supabase SERVICE KEY so RLS is bypassed server-side.
Protected by require_role("recruiter", "admin").
"""

from fastapi import APIRouter, Depends, HTTPException
from app.core.database import db
from app.core.auth import require_role

router = APIRouter(prefix="/api/recruiter", tags=["Recruiter"])


def _safe(result):
    return result.data if result.data else []


# ── GET /api/recruiter/students ───────────────────────────────────────────────
# Returns all intern profiles with their tasks nested.

@router.get("/students")
async def get_students(recruiter=Depends(require_role("recruiter", "admin"))):
    try:
        # Fetch all intern profiles
        profiles_res = db.table("profiles") \
            .select("*") \
            .eq("role", "intern") \
            .order("created_at", desc=True) \
            .execute()

        profiles = _safe(profiles_res)
        if not profiles:
            return []

        # Fetch all tasks for those intern IDs in one query
        intern_ids = [p["id"] for p in profiles]
        tasks_res = db.table("tasks") \
            .select("id,assigned_to,title,description,status,priority,score,github_pr_url,intern_role,created_at,updated_at") \
            .in_("assigned_to", intern_ids) \
            .execute()

        tasks = _safe(tasks_res)

        # Group tasks by intern ID
        tasks_by_intern: dict[str, list] = {}
        for t in tasks:
            aid = t.get("assigned_to")
            if aid:
                tasks_by_intern.setdefault(aid, []).append(t)

        # Attach tasks to each profile
        for p in profiles:
            p["tasks"] = tasks_by_intern.get(p["id"], [])

        return profiles

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


# ── GET /api/recruiter/students/{student_id} ──────────────────────────────────

@router.get("/students/{student_id}")
async def get_student(student_id: str, recruiter=Depends(require_role("recruiter", "admin"))):
    profile_res = db.table("profiles").select("*").eq("id", student_id).eq("role", "intern").execute()
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="Student not found")

    profile = profile_res.data[0]

    tasks_res = db.table("tasks") \
        .select("*") \
        .eq("assigned_to", student_id) \
        .order("created_at", desc=True) \
        .execute()

    profile["tasks"] = _safe(tasks_res)
    return profile