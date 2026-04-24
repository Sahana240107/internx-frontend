from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.core.config import settings
from app.core.database import db

# HTTPBearer reads the "Authorization: Bearer <token>" header automatically
security = HTTPBearer()


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


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    FastAPI dependency — add this to any route that needs a logged-in user.
    Usage:  async def my_route(user = Depends(get_current_user)):
    
    It reads the Bearer token from the request header,
    decodes it, then fetches the full profile from Supabase.
    """
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Fetch full profile from Supabase
    result = db.table("profiles").select("*").eq("id", user_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="User profile not found")

    return result.data


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
