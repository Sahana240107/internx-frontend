"""
FIXED: app/core/auth.py

ROOT CAUSE of "User profile not found" (404) on login:
  When a Supabase Auth user exists (e.g. created via invite / magic link) but
  there is no matching row in public.profiles, get_current_user raises 404.
  This happens because:
    1. The admin was created in Supabase Auth but profiles row was never seeded.
    2. A GitHub OAuth user's Supabase Auth ID differs from the profile ID.

FIX:
  - In get_current_user: if profile is missing, attempt to auto-create it from
    the Supabase Auth user metadata before raising 404.
  - Add get_current_user_optional for routes that tolerate anonymous access.
  - Everything else unchanged.
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.core.config import settings
from app.core.database import db

# HTTPBearer reads the "Authorization: Bearer <token>" header automatically
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)


def create_access_token(user_id: str, role: str, email: str) -> str:
    """
    Creates a signed JWT token.
    The token contains user_id, role, and email — no password ever stored.
    It expires after ACCESS_TOKEN_EXPIRE_MINUTES (7 days by default).
    """
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": user_id,       # "subject" — standard JWT field for user identity
        "role": role,
        "email": email,
        "exp": expire,        # expiry — JWT library checks this automatically
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """
    Decodes and validates a JWT token.
    Raises an exception if the token is invalid, expired, or tampered with.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _auto_create_profile(user_id: str, email: str, role: str = "intern") -> dict | None:
    """
    FIX: When a Supabase Auth user exists but has no public.profiles row,
    create a minimal profile so the request can proceed.

    This covers:
      - Admin/recruiter accounts created via Supabase dashboard invite.
      - Any edge-case where the GitHub OAuth callback didn't persist the profile.

    Returns the newly created profile dict, or None on failure.
    """
    try:
        # Try to get metadata from Supabase Auth admin API
        auth_users = db.auth.admin.list_users()
        auth_user = next((u for u in auth_users if str(u.id) == user_id), None)

        metadata = {}
        if auth_user:
            metadata = auth_user.user_metadata or {}
            email = email or auth_user.email or ""

        profile_data = {
            "id":    user_id,
            "email": email,
            "name":  metadata.get("full_name") or metadata.get("name") or email.split("@")[0],
            "avatar_url": metadata.get("avatar_url"),
            "role":  role,
        }

        result = db.table("profiles").upsert(profile_data).execute()
        if result.data:
            print(f"[auth] Auto-created profile for user {user_id} ({email})")
            return result.data[0]
    except Exception as e:
        print(f"[auth] Could not auto-create profile for {user_id}: {e}")

    return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    FastAPI dependency — add this to any route that needs a logged-in user.
    Usage:  async def my_route(user = Depends(get_current_user)):

    It reads the Bearer token from the request header,
    decodes it, then fetches the full profile from Supabase.

    FIX: If the profile row is missing, we attempt to auto-create it from
    Supabase Auth metadata instead of immediately raising 404.
    """
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    email   = payload.get("email", "")
    role    = payload.get("role", "intern")

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Fetch full profile from Supabase
    result = db.table("profiles").select("*").eq("id", user_id).single().execute()

    if result.data:
        return result.data

    # ── FIX: profile row missing — try to auto-create it ──────────────────────
    # This handles admin accounts created in Supabase Auth dashboard that never
    # got a profiles row, and any other gap between auth.users and profiles.
    profile = _auto_create_profile(user_id, email, role)
    if profile:
        return profile

    # Still nothing — surface a helpful error (not a bare 404)
    raise HTTPException(
        status_code=404,
        detail=(
            "User profile not found. "
            "If you're an admin or recruiter, ask a system administrator to run "
            "POST /api/auth/set-password with your user_id to initialise your account."
        )
    )


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security_optional)
) -> dict | None:
    """
    Like get_current_user but returns None instead of raising for unauthenticated
    requests. Use for routes that work both logged-in and anonymously.
    """
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def require_role(*roles: str):
    """
    Role-based access dependency factory.
    Usage:  async def admin_route(user = Depends(require_role("admin", "mentor"))):

    Raises 403 Forbidden if the user's role is not in the allowed list.
    """
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}"
            )
        return current_user
    return role_checker