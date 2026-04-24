import httpx
from fastapi import APIRouter, Depends, HTTPException
from app.core.config import settings
from app.core.database import db
from app.core.auth import create_access_token, get_current_user, require_role
from app.schemas.auth import (
    GitHubCallbackRequest, ProfileUpdate,
    RoleAssignRequest, TokenResponse, UserResponse
)

router = APIRouter()


def _get_active_project_id(user_id: str) -> str | None:
    """
    Returns the user's active project_id using the real schema:
      group_members → project_groups.project_id
    Falls back to profiles.project_id if not found.
    """
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

    # Fallback: profiles.project_id (set by /join endpoint)
    profile = db.table("profiles").select("project_id").eq("id", user_id).limit(1).execute()
    if profile.data and profile.data[0].get("project_id"):
        return profile.data[0]["project_id"]

    return None


@router.post("/github/callback", response_model=TokenResponse)
async def github_callback(body: GitHubCallbackRequest):
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id":     settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code":          body.code,
            },
            headers={"Accept": "application/json"},
        )
    token_data = token_response.json()
    if "error" in token_data:
        raise HTTPException(status_code=400, detail=f"GitHub OAuth error: {token_data['error_description']}")
    github_token = token_data["access_token"]

    async with httpx.AsyncClient() as client:
        user_response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {github_token}", "Accept": "application/vnd.github+json"},
        )
        email_response = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {github_token}", "Accept": "application/vnd.github+json"},
        )
    github_user   = user_response.json()
    github_emails = email_response.json()
    primary_email = next(
        (e["email"] for e in github_emails if e["primary"] and e["verified"]),
        github_user.get("email") or f"{github_user['login']}@github.local"
    )

    existing = db.table("profiles").select("*").eq("github_username", github_user["login"]).execute()

    if existing.data:
        profile = existing.data[0]
        db.table("profiles").update({
            "avatar_url": github_user.get("avatar_url"),
            "name":       github_user.get("name") or github_user["login"],
        }).eq("id", profile["id"]).execute()
        result  = db.table("profiles").select("*").eq("id", profile["id"]).single().execute()
        profile = result.data
    else:
        existing_auth = db.auth.admin.list_users()
        auth_user = next(
            (u for u in existing_auth if u.email == primary_email),
            None
        )
        if auth_user:
            new_id = auth_user.id
        else:
            auth_result = db.auth.admin.create_user({
                "email":         primary_email,
                "email_confirm": True,
                "user_metadata": {
                    "full_name":  github_user.get("name") or github_user["login"],
                    "avatar_url": github_user.get("avatar_url"),
                }
            })
            new_id = auth_result.user.id

        db.table("profiles").upsert({
            "id":              new_id,
            "email":           primary_email,
            "name":            github_user.get("name") or github_user["login"],
            "avatar_url":      github_user.get("avatar_url"),
            "github_username": github_user["login"],
            "role":            "intern",
        }).execute()
        result  = db.table("profiles").select("*").eq("id", new_id).single().execute()
        profile = result.data

    token = create_access_token(
        user_id = profile["id"],
        role    = profile["role"],
        email   = profile["email"],
    )
    return TokenResponse(access_token=token, user=UserResponse(**profile))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    payload = dict(current_user)

    # Resolve project_id from group_members (real schema), not project_members
    project_id = _get_active_project_id(current_user["id"])
    if project_id:
        payload["project_id"] = project_id
    elif not payload.get("project_id"):
        payload["project_id"] = None

    # Legacy fields — not used in the multiplayer schema
    payload.setdefault("cohort_id", None)
    payload.setdefault("team_role", None)

    return UserResponse(**payload)


@router.get("/my-project-id")
async def get_my_project_id(current_user: dict = Depends(get_current_user)):
    project_id = _get_active_project_id(current_user["id"])
    if not project_id:
        raise HTTPException(status_code=404, detail="No project found for this user")
    return {"project_id": project_id}


@router.put("/me", response_model=UserResponse)
async def update_me(body: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    db.table("profiles").update(updates).eq("id", current_user["id"]).execute()
    result = db.table("profiles").select("*").eq("id", current_user["id"]).single().execute()
    return UserResponse(**result.data)


@router.get("/users", response_model=list[UserResponse])
async def list_users(_: dict = Depends(require_role("mentor", "admin"))):
    result = db.table("profiles").select("*").order("created_at").execute()
    return [UserResponse(**u) for u in result.data]


@router.put("/role", response_model=UserResponse)
async def assign_role(body: RoleAssignRequest, _: dict = Depends(require_role("admin"))):
    result = db.table("profiles").update({"role": body.role}).eq("id", body.user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**result.data)
