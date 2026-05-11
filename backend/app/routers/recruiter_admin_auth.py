"""
InternX — Recruiter & Admin auth + management endpoints

Endpoints:
  POST /api/auth/recruiter/login        — recruiter login
  POST /api/auth/admin/login            — admin login
  POST /api/auth/set-password           — set password (admin utility)
  POST /api/auth/heartbeat              — update last_seen

  POST   /api/admin/recruiters          — create recruiter (admin only) ← NEW
  POST   /api/admin/recruiters/{id}/reset-password  ← NEW
  DELETE /api/admin/profiles/{id}       — delete any user  ← NEW
  PATCH  /api/admin/profiles/{id}/role  — change role       ← NEW
  GET    /api/admin/dashboard           — full dashboard data ← NEW
"""

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.auth import create_access_token
from app.core.database import db
import hashlib, os, uuid as uuid_lib
from datetime import datetime

router = APIRouter(tags=["recruiter-admin-auth"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def _find_user(username: str, role: str):
    r = db.table("profiles").select("*").eq("email", username).eq("role", role).execute()
    if r.data:
        return r.data[0]
    r = db.table("profiles").select("*").eq("github_username", username).eq("role", role).execute()
    return r.data[0] if r.data else None


def _verify_pw(user_id: str, raw: str) -> bool:
    hashed = _hash(raw)
    try:
        r = db.table("admin_credentials").select("password_hash").eq("user_id", user_id).execute()
        if r.data:
            return r.data[0]["password_hash"] == hashed
    except Exception:
        pass
    return raw == os.getenv("ADMIN_PASSWORD", "internx_admin_2025")


def _get_admin_from_token(authorization: str = Header(None)):
    """Simple JWT check — extract user_id and verify role=admin in profiles."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    # Use the same decode as the rest of the app
    from app.core.auth import decode_access_token
    payload = decode_access_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload


# ── request models ────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class CreateRecruiterRequest(BaseModel):
    name: str
    email: str
    password: str
    company: Optional[str] = None

class RoleUpdateRequest(BaseModel):
    role: str

class PasswordResetRequest(BaseModel):
    password: str

class HeartbeatRequest(BaseModel):
    user_id: str
    role: str


# ── auth endpoints ────────────────────────────────────────────────────────────

@router.post("/api/auth/recruiter/login")
async def recruiter_login(body: LoginRequest):
    user = _find_user(body.username, "recruiter")
    if not user:
        env_pw = os.getenv("RECRUITER_PASSWORD", "internx_recruiter_2025")
        if body.password != env_pw:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        return {
            "access_token": create_access_token("recruiter_dev", "recruiter", body.username),
            "token_type": "bearer",
            "user": {"id": "recruiter_dev", "name": body.username, "role": "recruiter", "email": body.username},
        }

    if not _verify_pw(user["id"], body.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Log session
    try:
        db.table("login_sessions").insert({
            "user_id": user["id"],
            "email": user["email"],
            "role": "recruiter",
            "logged_in_at": datetime.utcnow().isoformat(),
        }).execute()
    except Exception:
        pass

    return {
        "access_token": create_access_token(user["id"], user["role"], user["email"]),
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "avatar_url": user.get("avatar_url"),
        },
    }


@router.post("/api/auth/admin/login")
async def admin_login(body: LoginRequest):
    user = _find_user(body.username, "admin")
    if not user:
        env_pw = os.getenv("ADMIN_PASSWORD", "internx_admin_2025")
        if body.password != env_pw:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        return {
            "access_token": create_access_token("admin_dev", "admin", body.username),
            "token_type": "bearer",
            "user": {"id": "admin_dev", "name": "Admin", "role": "admin", "email": body.username},
            "dev_mode": True,
        }

    if not _verify_pw(user["id"], body.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    try:
        db.table("login_sessions").insert({
            "user_id": user["id"],
            "email": user["email"],
            "role": "admin",
            "logged_in_at": datetime.utcnow().isoformat(),
        }).execute()
    except Exception:
        pass

    return {
        "access_token": create_access_token(user["id"], user["role"], user["email"]),
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "avatar_url": user.get("avatar_url"),
        },
    }


@router.post("/api/auth/set-password")
async def set_password(body: dict):
    secret = os.getenv("ADMIN_SECRET", "internx_setup_secret")
    if body.get("admin_secret") != secret:
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    user_id = body.get("user_id")
    password = body.get("password")
    if not user_id or not password:
        raise HTTPException(status_code=400, detail="user_id and password required")
    db.table("admin_credentials").upsert({"user_id": user_id, "password_hash": _hash(password)}).execute()
    return {"message": "Password set successfully"}


@router.post("/api/auth/heartbeat")
async def heartbeat(body: HeartbeatRequest):
    try:
        db.table("profiles").update({"last_seen": datetime.utcnow().isoformat()}).eq("id", body.user_id).execute()
    except Exception:
        pass
    return {"ok": True}


# ── admin management endpoints ────────────────────────────────────────────────

@router.get("/api/admin/dashboard")
async def admin_dashboard(authorization: str = Header(None)):
    _get_admin_from_token(authorization)
    try:
        students   = db.table("profiles").select("*").eq("role", "intern").order("created_at", desc=True).execute().data or []
        recruiters = db.table("profiles").select("*").eq("role", "recruiter").order("created_at", desc=True).execute().data or []
        reports    = db.table("reports").select("*").order("created_at", desc=True).execute().data or []
        sessions   = db.table("login_sessions").select("*").order("logged_in_at", desc=True).limit(50).execute().data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "students":   students,
        "recruiters": recruiters,
        "reports":    reports,
        "sessions":   sessions,
    }


@router.post("/api/admin/recruiters")
async def create_recruiter(body: CreateRecruiterRequest, authorization: str = Header(None)):
    """Admin creates a recruiter with email + password. No GitHub needed."""
    _get_admin_from_token(authorization)

    # Check email not already taken
    existing = db.table("profiles").select("id").eq("email", body.email).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    new_id = str(uuid_lib.uuid4())

    # Insert profile
    try:
        profile_res = db.table("profiles").insert({
            "id":         new_id,
            "email":      body.email,
            "name":       body.name,
            "role":       "recruiter",
            "company":    body.company,
            "created_at": datetime.utcnow().isoformat(),
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create profile: {str(e)}")

    # Store hashed password
    try:
        db.table("admin_credentials").insert({
            "user_id":       new_id,
            "password_hash": _hash(body.password),
        }).execute()
    except Exception as e:
        # Roll back profile
        try:
            db.table("profiles").delete().eq("id", new_id).execute()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Could not set password: {str(e)}")

    profile = profile_res.data[0] if profile_res.data else {
        "id": new_id, "email": body.email, "name": body.name,
        "role": "recruiter", "company": body.company,
    }
    return profile


@router.post("/api/admin/recruiters/{user_id}/reset-password")
async def reset_recruiter_password(user_id: str, body: PasswordResetRequest, authorization: str = Header(None)):
    _get_admin_from_token(authorization)
    if not body.password or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    try:
        db.table("admin_credentials").upsert({
            "user_id":       user_id,
            "password_hash": _hash(body.password),
            "updated_at":    datetime.utcnow().isoformat(),
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"message": "Password reset successfully"}


@router.patch("/api/admin/profiles/{user_id}/role")
async def update_role(user_id: str, body: RoleUpdateRequest, authorization: str = Header(None)):
    _get_admin_from_token(authorization)
    allowed = {"intern", "admin", "recruiter"}
    if body.role not in allowed:
        raise HTTPException(status_code=400, detail=f"Role must be one of: {allowed}")
    try:
        res = db.table("profiles").update({"role": body.role}).eq("id", user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    return res.data[0]


@router.delete("/api/admin/profiles/{user_id}")
async def delete_user(user_id: str, authorization: str = Header(None)):
    _get_admin_from_token(authorization)
    try:
        db.table("profiles").delete().eq("id", user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"message": "User deleted"}


@router.patch("/api/admin/reports/{report_id}/status")
async def update_report_status(report_id: str, body: dict, authorization: str = Header(None)):
    _get_admin_from_token(authorization)
    status = body.get("status")
    if status not in {"open", "under_review", "resolved"}:
        raise HTTPException(status_code=400, detail="Invalid status")
    try:
        res = db.table("reports").update({"status": status, "updated_at": datetime.utcnow().isoformat()}).eq("id", report_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return res.data[0] if res.data else {"message": "Updated"}