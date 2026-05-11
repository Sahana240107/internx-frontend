"""
projects.py  (schema-corrected rewrite)
────────────────────────────────────────
Actual DB schema (from Supabase):
  user_projects   → id, user_id, project_id, github_repo_url, created_at, updated_at
                    (repo URL storage only — no role/status columns)
  project_groups  → id, project_id, name, cohort_label, status, repo_name, repo_url, created_at
                    (the "team" for a project — each group gets its own GitHub repo)
  group_members   → id, group_id, user_id, intern_role, github_repo_url, joined_at
                    (who is in which group, with their role)
  profiles        → has project_id and intern_role columns directly
  projects        → team_roles (jsonb), project_status, internx_repo_url, etc.

Membership flow:
  1. Find / create a project_group for the project
  2. Insert a group_members row for the user
  3. Set profiles.project_id for fast lookup
  4. Copy role-specific tasks to the user
  5. If all slots filled → activate project + trigger GitHub repo creation
     Repo name = {project-slug}-g{first-8-chars-of-group-id}
     so multiple groups of the same project never collide.

FIX: assign_role_tasks_to_user was being called in the "already in project"
early-return path AND again in the normal join path. This caused
initialise_sprint_for_intern to run twice, which:
  - Reset seeded tasks to the pool twice
  - Assigned initial tasks twice (bypassing the idempotency guard on the
    second call because the first call had already consumed the pool tasks)
Result: intern ended up with 4–6 tasks instead of 2.
Fix: removed the assign_role_tasks_to_user call from the early-return path.
The engine is idempotent — it only needs to run once at join time.

FIX 2: _get_user_group_membership used a nested PostgREST join
(.select("*, project_groups(id, project_id, status)")) which crashes
Cloudflare with Error 1101. Replaced with two flat queries.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from app.core.auth import get_current_user
from app.core.database import db
from app.core.config import settings
from app.services.github_service import setup_project_repo
import random, re, time, jwt, json, uuid, logging
from urllib.parse import quote
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/projects", tags=["projects"])

VALID_ROLES = {"frontend", "backend", "fullstack", "devops", "design", "tester"}


# ─── Pydantic models ──────────────────────────────────────────────────────────

class RepoUrlBody(BaseModel):
    repo_url: str

class JoinProjectBody(BaseModel):
    project_id: str | None = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_user_group_membership(user_id: str) -> dict | None:
    """
    Returns the user's active group_members row (with group_id, intern_role, etc.)
    or None if they haven't joined any group yet.

    FIX: Old code used .select("*, project_groups(id, project_id, status)") —
    a nested PostgREST join that crashes Cloudflare with Error 1101.
    Now returns the raw group_members row only. Callers that need project_id
    do a separate flat query on project_groups.
    """
    result = (
        db.table("group_members")
        .select("id, group_id, user_id, intern_role, github_repo_url, joined_at")
        .eq("user_id", user_id)
        .order("joined_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return result.data[0]


def _get_active_group_for_project(project_id: str) -> dict | None:
    """
    Returns the active/forming project_group for a project, or None.
    Prefers 'forming' over 'active' so new users join the forming group.
    """
    result = (
        db.table("project_groups")
        .select("*")
        .eq("project_id", project_id)
        .execute()
    )
    groups = result.data or []
    for status in ("forming", "active"):
        for g in groups:
            if g.get("status") == status:
                return g
    return groups[0] if groups else None


def _get_or_create_group(project_id: str, project: dict) -> dict:
    """Gets the forming group for a project, creating one if none exists."""
    group = _get_active_group_for_project(project_id)
    if group and group.get("status") == "forming":
        return group
    new_group = db.table("project_groups").insert({
        "id":           str(uuid.uuid4()),
        "project_id":   project_id,
        "name":         f"{project.get('project_title', 'Project')} Team",
        "cohort_label": "cohort-1",
        "status":       "forming",
        "created_at":   _now(),
    }).execute()
    return new_group.data[0]


def _count_role_in_group(group_id: str, intern_role: str) -> int:
    """Count how many members with the given role are in this group."""
    result = (
        db.table("group_members")
        .select("id", count="exact")
        .eq("group_id", group_id)
        .eq("intern_role", intern_role)
        .execute()
    )
    return result.count or 0


def _get_team_for_group(group_id: str) -> list[dict]:
    """
    Return all team members for a specific group, enriched with profile info.
    Each entry includes 'membership_id' (the group_members.id) so callers
    can update the exact row without ambiguity.
    """
    members_res = (
        db.table("group_members")
        .select("id, user_id, intern_role, github_repo_url, joined_at")
        .eq("group_id", group_id)
        .execute()
    )
    if not members_res.data:
        return []

    user_ids = [m["user_id"] for m in members_res.data]
    profiles_res = (
        db.table("profiles")
        .select("id, name, avatar_url, github_username, intern_role")
        .in_("id", user_ids)
        .execute()
    )
    profile_map = {p["id"]: p for p in (profiles_res.data or [])}

    team = []
    for m in members_res.data:
        profile = profile_map.get(m["user_id"], {})
        team.append({
            "membership_id":   m["id"],
            "user_id":         m["user_id"],
            "intern_role":     m["intern_role"],
            "group_id":        group_id,
            "joined_at":       m["joined_at"],
            "name":            profile.get("name", "Unknown"),
            "avatar_url":      profile.get("avatar_url"),
            "github_username": profile.get("github_username"),
        })
    return team


def _get_team_for_project(project_id: str) -> list[dict]:
    """Return all team members for a project's active/forming group."""
    group = _get_active_group_for_project(project_id)
    if not group:
        return []
    return _get_team_for_group(group["id"])


def assign_role_tasks_to_user(
    project_id: str,
    user_id: str,
    intern_role: str,
    group_id: str | None = None,
):
    """
    Initialise Sprint 0 for an intern using the adaptive pool engine.

    The engine will:
      1. Get/create Sprint 0 for this role (named "Sprint 0 — {Role}")
      2. Build the task pool:  ceil(member_count × 3.5) tasks split 43/43/14
      3. Assign initial 2 tasks (1 easy + 1 medium) to this intern
      4. Leave the remaining pool unassigned

    Idempotent — the engine's assign_initial_tasks hard-guards: if intern
    already has ≥ 2 tasks in the sprint it skips entirely.

    IMPORTANT: Only call this ONCE per user join, not on every request.
    The old code called this in the "already in project" early-return path
    AND in the normal join path — that caused double-assignment (6 tasks).
    Now it is only called in the normal join path.
    """
    try:
        from app.services.adaptive_engine import initialise_sprint_for_intern
        initialise_sprint_for_intern(
            user_id=user_id,
            project_id=project_id,
            group_id=group_id,
            intern_role=intern_role,
        )
    except Exception as e:
        logger.error(
            f"[AdaptiveEngine] assign_role_tasks_to_user failed "
            f"user={user_id} project={project_id} role={intern_role}: {e}",
            exc_info=True,
        )


def _get_user_repo_url(project_id: str, user_id: str) -> str:
    """Get the user's personal repo URL from user_projects."""
    result = (
        db.table("user_projects")
        .select("github_repo_url")
        .eq("user_id", user_id)
        .eq("project_id", project_id)
        .limit(1)
        .execute()
    )
    return (result.data[0].get("github_repo_url") or "") if result.data else ""


def _save_user_repo_url(project_id: str, user_id: str, repo_url: str):
    """Upsert the user's personal repo URL in user_projects."""
    existing = (
        db.table("user_projects").select("id")
        .eq("user_id", user_id)
        .eq("project_id", project_id)
        .execute()
    )
    payload = {
        "user_id":         user_id,
        "project_id":      project_id,
        "github_repo_url": repo_url,
        "updated_at":      _now(),
    }
    if existing.data:
        db.table("user_projects").update(payload).eq("user_id", user_id).eq("project_id", project_id).execute()
    else:
        payload["id"] = str(uuid.uuid4())
        payload["created_at"] = _now()
        db.table("user_projects").insert(payload).execute()


def _enrich_project(project: dict, user_id: str, intern_role: str = "") -> dict:
    """Add user-specific fields to project dict."""
    project["user_repo_url"] = _get_user_repo_url(project["id"], user_id)
    project["intern_role"] = intern_role
    return project


def _activate_project_github(project_id: str, group_id: str):
    """
    Background task: create a unique GitHub repo for this specific group,
    then invite all its members as collaborators.
    """
    if not settings.github_org_token:
        logger.warning("GITHUB_ORG_TOKEN not set — skipping repo creation")
        return
    try:
        project_res = db.table("projects").select("*").eq("id", project_id).execute()
        if not project_res.data:
            logger.error(f"_activate_project_github: project {project_id} not found")
            return
        project = project_res.data[0]

        team = _get_team_for_group(group_id)
        if not team:
            logger.warning(f"_activate_project_github: group {group_id} has no members")
            return

        usernames = [m["github_username"] for m in team if m.get("github_username")]

        tech_stack = project.get("tech_stack", [])
        if isinstance(tech_stack, str):
            try:
                tech_stack = json.loads(tech_stack)
            except Exception:
                tech_stack = [tech_stack]

        result = setup_project_repo(
            project_title=project["project_title"],
            group_id=group_id,
            project_description=project.get("project_description", ""),
            tech_stack=tech_stack,
            github_usernames=usernames,
        )

        repo_url  = result["repo_url"]
        repo_name = result["repo_name"]

        db.table("project_groups").update({
            "repo_url":  repo_url,
            "repo_name": repo_name,
        }).eq("id", group_id).execute()

        db.table("projects").update({
            "internx_repo_url": repo_url,
        }).eq("id", project_id).execute()

        for member in team:
            db.table("group_members").update({
                "github_repo_url": repo_url,
            }).eq("id", member["membership_id"]).execute()

            _save_user_repo_url(project_id, member["user_id"], repo_url)

        logger.info(
            f"GitHub repo created for group {group_id} (project {project_id}): "
            f"{repo_url} | invited: {result['invited']} | failed: {result['failed']}"
        )

    except Exception as e:
        logger.error(
            f"GitHub repo creation failed for group {group_id} / project {project_id}: {e}",
            exc_info=True,
        )


def _check_and_activate_project(
    project_id: str,
    project: dict,
    background_tasks: BackgroundTasks,
) -> bool:
    """
    Check if all slots for this project's forming group are filled.
    If yes, mark project and its group as active and fire the GitHub repo task.
    """
    team_roles = project.get("team_roles") or {}
    if not team_roles:
        return False

    group = _get_active_group_for_project(project_id)
    if not group:
        return False

    if group.get("status") == "active" and not group.get("repo_url"):
        logger.info(
            f"Group {group['id']} is active but has no repo — re-triggering GitHub repo creation"
        )
        background_tasks.add_task(_activate_project_github, project_id, group["id"])
        return True

    for role, required_count in team_roles.items():
        filled = _count_role_in_group(group["id"], role)
        if filled < required_count:
            return False

    db.table("projects").update({"project_status": "active"}).eq("id", project_id).execute()
    db.table("project_groups").update({"status": "active"}).eq("id", group["id"]).execute()

    logger.info(
        f"Project {project_id} / group {group['id']} is now fully staffed — "
        f"triggering GitHub repo creation"
    )

    background_tasks.add_task(_activate_project_github, project_id, group["id"])
    return True


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/")
async def list_projects(current_user: dict = Depends(get_current_user)):
    result = db.table("projects").select("*").execute()
    return result.data


@router.get("/available")
async def list_available_projects(current_user: dict = Depends(get_current_user)):
    """
    Returns projects that have at least one open slot for the current user's role.
    Excludes projects the user has already joined.
    """
    intern_role = current_user.get("intern_role")
    if not intern_role:
        raise HTTPException(400, "Complete onboarding first — no intern_role set")

    # Find projects the user has already joined — flat queries only
    memberships = (
        db.table("group_members")
        .select("group_id")
        .eq("user_id", current_user["id"])
        .execute()
    )
    joined_project_ids = set()
    for m in (memberships.data or []):
        gid = m.get("group_id")
        if gid:
            pg = (
                db.table("project_groups")
                .select("project_id")
                .eq("id", gid)
                .limit(1)
                .execute()
            )
            if pg.data and pg.data[0].get("project_id"):
                joined_project_ids.add(pg.data[0]["project_id"])

    all_projects = (
        db.table("projects").select("*")
        .eq("project_status", "open")
        .execute()
    )
    if not all_projects.data:
        return []

    available = []
    for p in all_projects.data:
        if p["id"] in joined_project_ids:
            continue

        team_roles = p.get("team_roles") or {}
        if not team_roles:
            if p.get("intern_role") == intern_role:
                p["open_slots_for_role"] = 1
                available.append(p)
            continue

        if intern_role not in team_roles:
            continue

        group = _get_active_group_for_project(p["id"])
        if group:
            filled = _count_role_in_group(group["id"], intern_role)
        else:
            filled = 0

        required = team_roles[intern_role]
        if filled < required:
            p["open_slots_for_role"] = required - filled
            available.append(p)

    return available


@router.post("/join")
async def join_project(
    body: JoinProjectBody,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """
    Assigns the user to a project that has a vacancy for their intern_role.
    - If body.project_id is given, joins that specific project.
    - Otherwise auto-picks a random available project.
    - Idempotent: if already in a project, returns it immediately WITHOUT
      re-running the adaptive engine (that was the source of the 6-task bug).
    """
    user_id     = current_user["id"]
    intern_role = current_user.get("intern_role")

    if not intern_role:
        raise HTTPException(400, "Complete onboarding first")
    if intern_role not in VALID_ROLES:
        raise HTTPException(400, f"Invalid intern_role: {intern_role}")

    # ── Already in a project? Return it immediately ───────────────
    # FIX: Do NOT call assign_role_tasks_to_user here. The engine already
    # ran when the user first joined. Calling it again caused a second
    # initialise_sprint_for_intern which doubled the task assignments.
    existing = _get_user_group_membership(user_id)
    if existing:
        group_id = existing.get("group_id")
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

        # Fallback: profiles.project_id
        if not project_id:
            profile = (
                db.table("profiles")
                .select("project_id")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            if profile.data:
                project_id = profile.data[0].get("project_id")

        if project_id:
            project_res = db.table("projects").select("*").eq("id", project_id).execute()
            if project_res.data:
                # Return early — no task engine call here
                return _enrich_project(dict(project_res.data[0]), user_id, intern_role)

    # ── Find a suitable project ───────────────────────────────────
    if body.project_id:
        project_res = db.table("projects").select("*").eq("id", body.project_id).execute()
        if not project_res.data:
            raise HTTPException(404, "Project not found")
        candidates = project_res.data
    else:
        candidates_res = db.table("projects").select("*").eq("project_status", "open").execute()
        candidates = candidates_res.data or []
        random.shuffle(candidates)

    chosen = None
    chosen_group = None

    for p in candidates:
        team_roles = p.get("team_roles") or {}

        if not team_roles:
            if p.get("intern_role") == intern_role:
                group = _get_or_create_group(p["id"], p)
                chosen = p
                chosen_group = group
                break
            continue

        if intern_role not in team_roles:
            continue

        group = _get_or_create_group(p["id"], p)
        filled = _count_role_in_group(group["id"], intern_role)
        if filled < team_roles[intern_role]:
            chosen = p
            chosen_group = group
            break

    if not chosen:
        raise HTTPException(
            404,
            f"No projects with open slots for role '{intern_role}'. "
            "Check back later or ask an admin to add more projects."
        )

    project_id = chosen["id"]

    # ── Add user to group_members ─────────────────────────────────
    db.table("group_members").insert({
        "id":          str(uuid.uuid4()),
        "group_id":    chosen_group["id"],
        "user_id":     user_id,
        "intern_role": intern_role,
        "joined_at":   _now(),
    }).execute()

    # Update profiles.project_id for fast lookup
    db.table("profiles").update({"project_id": project_id}).eq("id", user_id).execute()

    # Initialise Sprint 0 + assign 1 easy + 1 medium task — called ONCE here only
    assign_role_tasks_to_user(project_id, user_id, intern_role, group_id=chosen_group["id"])

    # ── Check if team is now full → activate + create GitHub repo ─
    _check_and_activate_project(project_id, chosen, background_tasks)

    return _enrich_project(dict(chosen), user_id, intern_role)


@router.post("/assign")
async def assign_project(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Backward-compatible single-player assign. Delegates to join logic."""
    return await join_project(JoinProjectBody(), background_tasks, current_user)


@router.get("/{project_id}/team")
async def get_project_team(project_id: str, current_user: dict = Depends(get_current_user)):
    """Returns all active team members and open slots for a project."""
    project_res = db.table("projects").select("*").eq("id", project_id).execute()
    if not project_res.data:
        raise HTTPException(404, "Project not found")
    project = project_res.data[0]

    team = _get_team_for_project(project_id)
    team_roles = project.get("team_roles") or {}

    slots = []
    for role, total in team_roles.items():
        filled_members = [m for m in team if m["intern_role"] == role]
        slots.append({
            "role":         role,
            "total_slots":  total,
            "filled_slots": len(filled_members),
            "open_slots":   total - len(filled_members),
            "members":      filled_members,
        })

    group = _get_active_group_for_project(project_id)
    group_repo_url = (group or {}).get("repo_url") or None

    return {
        "project_id":     project_id,
        "project_status": project.get("project_status", "open"),
        "internx_repo":   group_repo_url,
        "slots":          slots,
        "team":           team,
    }


@router.get("/{project_id}/groups")
async def get_project_groups(project_id: str, current_user: dict = Depends(get_current_user)):
    """
    Returns all project_groups for this project that have at least one member.
    If the project only has one group, falls back to virtual role-based sub-teams.
    """
    import hashlib

    groups_res = (
        db.table("project_groups")
        .select("id, project_id, name, cohort_label, status")
        .eq("project_id", project_id)
        .execute()
    )
    groups = groups_res.data or []

    if len(groups) >= 2:
        return groups

    group = groups[0] if groups else None
    if not group:
        return []

    group_id = group["id"]

    members_res = (
        db.table("group_members")
        .select("intern_role")
        .eq("group_id", group_id)
        .execute()
    )
    roles = sorted({m["intern_role"] for m in (members_res.data or []) if m.get("intern_role")})

    if len(roles) <= 1:
        return []

    role_labels = {
        "frontend":  "Frontend Team",
        "backend":   "Backend Team",
        "fullstack": "Fullstack Team",
        "devops":    "DevOps Team",
        "design":    "Design Team",
        "tester":    "QA / Testing Team",
    }

    virtual_teams = []
    for role in roles:
        role_hash = hashlib.md5(f"{group_id}:{role}".encode()).hexdigest()
        virtual_id = f"{group_id[:8]}-{role_hash[:4]}-{role_hash[4:8]}-{role_hash[8:12]}-{role_hash[12:24]}"
        virtual_teams.append({
            "id":            virtual_id,
            "project_id":    project_id,
            "name":          role_labels.get(role, role.title() + " Team"),
            "cohort_label":  group.get("cohort_label"),
            "status":        group.get("status"),
            "virtual":       True,
            "real_group_id": group_id,
            "role":          role,
        })

    return virtual_teams


@router.get("/{project_id}")
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    result = db.table("projects").select("*").eq("id", project_id).execute()
    if not result.data:
        raise HTTPException(404, "Project not found")
    return _enrich_project(dict(result.data[0]), current_user["id"])


@router.patch("/{project_id}/repo")
async def update_repo_url(
    project_id: str,
    body: RepoUrlBody,
    current_user: dict = Depends(get_current_user),
):
    """Save this user's personal GitHub repo URL for this project."""
    repo_url = body.repo_url.strip()
    if not repo_url:
        raise HTTPException(400, "repo_url is required")
    if "github.com" not in repo_url:
        raise HTTPException(400, "Must be a valid GitHub URL")

    result = db.table("projects").select("id").eq("id", project_id).execute()
    if not result.data:
        raise HTTPException(404, "Project not found")

    _save_user_repo_url(project_id, current_user["id"], repo_url)
    return {"repo_url": repo_url}


@router.post("/{project_id}/retry-repo")
async def retry_repo_creation(
    project_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Manually re-trigger GitHub repo creation for a project's active group."""
    project_res = db.table("projects").select("*").eq("id", project_id).execute()
    if not project_res.data:
        raise HTTPException(404, "Project not found")

    group = _get_active_group_for_project(project_id)
    if not group:
        raise HTTPException(400, "No active or forming group found for this project")

    if not settings.github_org_token:
        raise HTTPException(
            503,
            "GITHUB_ORG_TOKEN is not configured on the server. "
            "Add it to .env and restart the backend."
        )

    background_tasks.add_task(_activate_project_github, project_id, group["id"])

    return {
        "status":     "queued",
        "project_id": project_id,
        "group_id":   group["id"],
        "message":    (
            "Repo creation has been queued. "
            "Refresh /team in ~10 seconds to see the repo URL."
        ),
    }


@router.post("/{project_id}/setup-token")
async def get_setup_token(project_id: str, current_user: dict = Depends(get_current_user)):
    result = db.table("projects").select("*").eq("id", project_id).execute()
    if not result.data:
        raise HTTPException(404, "Project not found")
    project = result.data[0]

    group = _get_active_group_for_project(project_id)
    group_repo_url = (group or {}).get("repo_url") if group else None
    repo_url = (
        group_repo_url
        or _get_user_repo_url(project_id, current_user["id"])
    )

    if not repo_url:
        raise HTTPException(
            400,
            "No GitHub repo configured yet. "
            "If you just joined, the repo is created when the full team is assembled. "
            "Otherwise, add your repo URL in the Overview tab."
        )

    match = re.search(r"github\.com[/:](.+?/.+?)(?:\.git)?$", repo_url.strip())
    if not match:
        raise HTTPException(400, f"Invalid GitHub URL: {repo_url}")
    repo = match.group(1).rstrip("/")

    github_username = (
        current_user.get("github_username")
        or current_user.get("name", "intern").lower().replace(" ", "-")
    )
    intern_role = current_user.get("intern_role", "intern")
    branch = f"{github_username}-{intern_role}-dev"

    token = jwt.encode(
        {
            "user_id": current_user["id"],
            "repo":    repo,
            "branch":  branch,
            "exp":     time.time() + 300,
        },
        settings.jwt_secret,
        algorithm="HS256",
    )

    raw_structure = project.get("folder_structure")
    folder_structure = None
    if isinstance(raw_structure, dict):
        folder_structure = raw_structure
    elif isinstance(raw_structure, str):
        try:
            folder_structure = json.loads(raw_structure)
        except Exception:
            pass

    task_id = None
    try:
        task_result = (
            db.table("tasks").select("id")
            .eq("project_id", project_id)
            .eq("assigned_to", current_user["id"])
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
        if task_result.data:
            task_id = task_result.data[0]["id"]
    except Exception:
        pass

    internx_token = jwt.encode(
        {"user_id": current_user["id"], "exp": time.time() + 86400 * 30},
        settings.jwt_secret,
        algorithm="HS256",
    )
    backend_url = settings.backend_url
    setup_url = f"internx://setup?repo={repo}&branch={branch}&token={token}"
    if task_id:
        setup_url += f"&task_id={task_id}"
    setup_url += f"&internx_token={internx_token}&api_url={quote(backend_url)}"
    if folder_structure:
        setup_url += f"&folderStructure={quote(json.dumps(folder_structure))}"

    return {
        "setup_url":  setup_url,
        "repo":       repo,
        "branch":     branch,
        "task_id":    task_id,
        "expires_in": 300,
    }


@router.get("/groups/{group_id}")
async def get_group(group_id: str, current_user: dict = Depends(get_current_user)):
    result = db.table("project_groups").select("*").eq("id", group_id).execute()
    if not result.data:
        raise HTTPException(404, "Group not found")
    return result.data[0]