"""
app/routers/admin.py

All admin dashboard data endpoints.
Uses the Supabase SERVICE KEY (via db) so RLS is bypassed server-side.
Every route is protected by require_role("admin") — the admin JWT is verified first.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from app.core.database import db
from app.core.auth import require_role, get_current_user

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ── helpers ──────────────────────────────────────────────────────────────────

def _safe(result):
    """Return result.data as a list, never raise on empty."""
    return result.data if result.data else []


# ── GET /api/admin/dashboard ─────────────────────────────────────────────────
# Returns all data the admin dashboard needs in one shot.

@router.get("/dashboard")
async def get_dashboard(admin=Depends(require_role("admin"))):
    try:
        profiles_res  = db.table("profiles").select("*").order("created_at", desc=True).execute()
        reports_res   = db.table("reports").select("*").order("created_at", desc=True).execute()
        sessions_res  = db.table("login_sessions").select("*").order("logged_in_at", desc=True).limit(50).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

    profiles = _safe(profiles_res)
    reports  = _safe(reports_res)
    sessions = _safe(sessions_res)

    students   = [p for p in profiles if p.get("role") == "intern"]
    recruiters = [p for p in profiles if p.get("role") == "recruiter"]
    mentors    = [p for p in profiles if p.get("role") == "mentor"]

    return {
        "students":   students,
        "recruiters": recruiters,
        "mentors":    mentors,
        "reports":    reports,
        "sessions":   sessions,
        "stats": {
            "total_students":   len(students),
            "total_recruiters": len(recruiters),
            "total_mentors":    len(mentors),
            "open_reports":     len([r for r in reports if r.get("status") == "open"]),
            "under_review":     len([r for r in reports if r.get("status") == "under_review"]),
        }
    }


# ── GET /api/admin/profiles ──────────────────────────────────────────────────

@router.get("/profiles")
async def get_profiles(role: Optional[str] = None, admin=Depends(require_role("admin"))):
    query = db.table("profiles").select("*").order("created_at", desc=True)
    if role:
        query = query.eq("role", role)
    result = query.execute()
    return _safe(result)


# ── PATCH /api/admin/profiles/{user_id}/role ─────────────────────────────────

class RoleUpdate(BaseModel):
    role: str

@router.patch("/profiles/{user_id}/role")
async def update_role(user_id: str, body: RoleUpdate, admin=Depends(require_role("admin"))):
    allowed = {"intern", "recruiter", "mentor", "admin"}
    if body.role not in allowed:
        raise HTTPException(status_code=400, detail=f"Role must be one of {allowed}")
    result = db.table("profiles").update({"role": body.role}).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return result.data[0]


# ── DELETE /api/admin/profiles/{user_id} ─────────────────────────────────────

@router.delete("/profiles/{user_id}")
async def delete_user(user_id: str, admin=Depends(require_role("admin"))):
    # Prevent self-deletion
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    db.table("profiles").delete().eq("id", user_id).execute()
    return {"deleted": user_id}


# ── GET /api/admin/reports ───────────────────────────────────────────────────

@router.get("/reports")
async def get_reports(admin=Depends(require_role("admin"))):
    result = db.table("reports").select("*").order("created_at", desc=True).execute()
    return _safe(result)


# ── PATCH /api/admin/reports/{report_id}/status ──────────────────────────────

class StatusUpdate(BaseModel):
    status: str

@router.patch("/reports/{report_id}/status")
async def update_report_status(report_id: str, body: StatusUpdate, admin=Depends(require_role("admin"))):
    allowed = {"open", "under_review", "resolved"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Status must be one of {allowed}")
    now = datetime.now(timezone.utc).isoformat()
    result = db.table("reports").update({"status": body.status, "updated_at": now}).eq("id", report_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Report not found")
    return result.data[0]


# ── GET /api/admin/sessions ──────────────────────────────────────────────────

@router.get("/sessions")
async def get_sessions(admin=Depends(require_role("admin"))):
    result = db.table("login_sessions").select("*").order("logged_in_at", desc=True).limit(50).execute()
    return _safe(result)


# ── POST /api/admin/recruiters  — create a new recruiter from admin dashboard ─

import hashlib, uuid as _uuid

class CreateRecruiterBody(BaseModel):
    name: str
    email: str
    password: str
    company: Optional[str] = ""

@router.post("/recruiters")
async def create_recruiter(body: CreateRecruiterBody, admin=Depends(require_role("admin"))):
    email = body.email.strip().lower()

    # Check duplicate
    existing = db.table("profiles").select("id").eq("email", email).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"A user with email {email} already exists")

    uid = str(_uuid.uuid4())
    pw_hash = hashlib.sha256(body.password.encode()).hexdigest()

    db.table("profiles").insert({
        "id":      uid,
        "email":   email,
        "name":    body.name.strip(),
        "role":    "recruiter",
        "company": body.company or "",
    }).execute()

    db.table("admin_credentials").upsert({
        "user_id":       uid,
        "password_hash": pw_hash,
    }).execute()

    return {
        "id":    uid,
        "email": email,
        "name":  body.name,
        "role":  "recruiter",
        "company": body.company,
    }


# ── POST /api/admin/recruiters/{user_id}/reset-password ──────────────────────

class ResetPasswordBody(BaseModel):
    password: str

@router.post("/recruiters/{user_id}/reset-password")
async def reset_recruiter_password(user_id: str, body: ResetPasswordBody, admin=Depends(require_role("admin"))):
    pw_hash = hashlib.sha256(body.password.encode()).hexdigest()
    db.table("admin_credentials").upsert({
        "user_id":       user_id,
        "password_hash": pw_hash,
    }).execute()
    return {"ok": True, "message": "Password reset successfully"}