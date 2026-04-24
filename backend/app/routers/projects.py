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

Required SQL (run once in Supabase):
  alter table public.project_groups
    add column if not exists repo_name text,
    add column if not exists repo_url  text;
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
    """
    result = (
        db.table("group_members")
        .select("*, project_groups(id, project_id, status)")
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        return None
    # Return the most recently joined membership
    return sorted(result.data, key=lambda r: r.get("joined_at") or "", reverse=True)[0]


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
    # Prefer forming groups first, then active
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
    # Create a new forming group
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
            "membership_id":   m["id"],          # group_members PK — used for targeted updates
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


def assign_role_tasks_to_user(project_id: str, user_id: str, intern_role: str):
    """
    Copy template tasks (assigned_to IS NULL) matching this user's role
    into their personal task list. Idempotent.
    """
    existing = (
        db.table("tasks").select("id")
        .eq("project_id", project_id)
        .eq("assigned_to", user_id)
        .execute()
    )
    if existing.data:
        return  # already assigned

    templates = (
        db.table("tasks").select("*")
        .eq("project_id", project_id)
        .eq("intern_role", intern_role)
        .is_("assigned_to", "null")
        .execute()
    )
    if not templates.data:
        logger.warning(f"No template tasks for role={intern_role} project={project_id}")
        return

    # Find or create the active sprint for this project
    sprint_id = _get_or_create_sprint(project_id, user_id)

    now = _now()
    new_tasks = [
        {
            "id":          str(uuid.uuid4()),
            "project_id":  project_id,
            "assigned_to": user_id,
            "sprint_id":   sprint_id or t.get("sprint_id"),
            "title":       t["title"],
            "description": t.get("description"),
            "priority":    t.get("priority", "medium"),
            "status":      "todo",
            "due_date":    t.get("due_date"),
            "resources":   t.get("resources"),
            "intern_role": intern_role,
            "created_at":  now,
            "updated_at":  now,
            "created_by":  user_id,
        }
        for t in templates.data
    ]
    db.table("tasks").insert(new_tasks).execute()


def _get_or_create_sprint(project_id: str, user_id: str) -> str | None:
    """Returns the active sprint_id for a project, creating one if needed."""
    existing = (
        db.table("sprints")
        .select("id")
        .eq("project_id", project_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]["id"]

    from datetime import date, timedelta
    today = date.today()
    try:
        created = db.table("sprints").insert({
            "id":          str(uuid.uuid4()),
            "project_id":  project_id,
            "title":       "Sprint 1",
            "description": "First sprint",
            "start_date":  today.isoformat(),
            "end_date":    (today + timedelta(days=14)).isoformat(),
            "is_active":   True,
            "created_by":  user_id,
        }).execute()
        return created.data[0]["id"] if created.data else None
    except Exception as e:
        logger.warning(f"Could not create sprint for project {project_id}: {e}")
        return None


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

    Repo name pattern: {project-slug}-g{first-8-hex-of-group-uuid}
    e.g.  ecommerce-platform-g3f2a1b0

    This means two groups of the same project get separate repos:
      ecommerce-platform-g3f2a1b0   ← group 1
      ecommerce-platform-g9c1d2e5   ← group 2

    The repo URL is stored on:
      • project_groups.repo_url          (authoritative per-group record)
      • group_members.github_repo_url    (per-member row, used by VS Code connect)
      • user_projects.github_repo_url    (used by setup-token endpoint)
      • projects.internx_repo_url        (last-write-wins; fine for display)
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

        # Fetch only THIS group's members (not all groups of the same project)
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

        # setup_project_repo now receives group_id so it can build a unique name
        result = setup_project_repo(
            project_title=project["project_title"],
            group_id=group_id,
            project_description=project.get("project_description", ""),
            tech_stack=tech_stack,
            github_usernames=usernames,
        )

        repo_url  = result["repo_url"]
        repo_name = result["repo_name"]

        # 1. Store on project_groups (each group keeps its own repo reference)
        db.table("project_groups").update({
            "repo_url":  repo_url,
            "repo_name": repo_name,
        }).eq("id", group_id).execute()

        # 2. Keep projects.internx_repo_url in sync (last-write wins — okay for display)
        db.table("projects").update({
            "internx_repo_url": repo_url,
        }).eq("id", project_id).execute()

        # 3. Save the URL on each member's group_members row and user_projects,
        #    using membership_id so we update the exact row, not every row for that user
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
    Also re-triggers repo creation if the group is already active but has no repo yet
    (handles cases where members joined before the GitHub service was wired up).
    Returns True if activation was triggered.
    """
    team_roles = project.get("team_roles") or {}
    if not team_roles:
        return False

    group = _get_active_group_for_project(project_id)
    if not group:
        return False

    # If group is already active but missing a repo URL, re-trigger creation
    if group.get("status") == "active" and not group.get("repo_url"):
        logger.info(
            f"Group {group['id']} is active but has no repo — re-triggering GitHub repo creation"
        )
        background_tasks.add_task(_activate_project_github, project_id, group["id"])
        return True

    for role, required_count in team_roles.items():
        filled = _count_role_in_group(group["id"], role)
        if filled < required_count:
            return False  # Still waiting for this role

    # All slots filled — activate the group and project
    db.table("projects").update({"project_status": "active"}).eq("id", project_id).execute()
    db.table("project_groups").update({"status": "active"}).eq("id", group["id"]).execute()

    logger.info(
        f"Project {project_id} / group {group['id']} is now fully staffed — "
        f"triggering GitHub repo creation"
    )

    # Fire-and-forget in a background thread; pass both IDs so the repo gets a unique name
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

    # Find projects the user has already joined via group_members
    memberships = (
        db.table("group_members")
        .select("project_groups(project_id)")
        .eq("user_id", current_user["id"])
        .execute()
    )
    joined_project_ids = set()
    for m in (memberships.data or []):
        pg = m.get("project_groups")
        if pg and pg.get("project_id"):
            joined_project_ids.add(pg["project_id"])

    # All open projects
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
            # Single-role project
            if p.get("intern_role") == intern_role:
                p["open_slots_for_role"] = 1
                available.append(p)
            continue

        if intern_role not in team_roles:
            continue

        # Check vacancy in the forming group
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
    - Idempotent: if already in a project, returns it immediately.
    """
    user_id     = current_user["id"]
    intern_role = current_user.get("intern_role")

    if not intern_role:
        raise HTTPException(400, "Complete onboarding first")
    if intern_role not in VALID_ROLES:
        raise HTTPException(400, f"Invalid intern_role: {intern_role}")

    # ── Already in a project? Return it ──────────────────────────
    existing = _get_user_group_membership(user_id)
    if existing:
        pg = existing.get("project_groups") or {}
        project_id = pg.get("project_id") if isinstance(pg, dict) else None
        if not project_id:
            # Fallback: check profiles
            profile = db.table("profiles").select("project_id").eq("id", user_id).limit(1).execute()
            project_id = profile.data[0].get("project_id") if profile.data else None

        if project_id:
            project_res = db.table("projects").select("*").eq("id", project_id).execute()
            if project_res.data:
                assign_role_tasks_to_user(project_id, user_id, intern_role)
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

    # Copy role-specific tasks + ensure sprint exists
    assign_role_tasks_to_user(project_id, user_id, intern_role)

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

    # Use only project_groups.repo_url — this is set when the GitHub repo is actually
    # created for this group. Do NOT fall back to projects.internx_repo_url because
    # that column may hold a stale hardcoded URL from before the multiplayer system.
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
    If the project only has one group (common single-cohort setup), falls back to
    returning virtual role-based sub-teams derived from group_members.intern_role,
    so the tickets "Addressed To" picker is never empty.

    Each item has: id, project_id, name, cohort_label, status.
    Virtual role items additionally carry virtual=True, real_group_id, role.
    """
    import hashlib

    # 1. Real groups for this project
    groups_res = (
        db.table("project_groups")
        .select("id, project_id, name, cohort_label, status")
        .eq("project_id", project_id)
        .execute()
    )
    groups = groups_res.data or []

    # If 2+ distinct groups exist, return them directly
    if len(groups) >= 2:
        return groups

    # ── Single-group project: synthesise virtual role-teams ──────────────────
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
    """
    Manually re-trigger GitHub repo creation for a project's active group.

    Use this when:
    - The team is fully assembled but the repo was never created (e.g. GITHUB_ORG_TOKEN
      was missing or wrong when the last member joined).
    - The repo URL is missing from the UI even though the project is 'active'.

    Safe to call multiple times — if the repo already exists on GitHub the service
    fetches it instead of re-creating it, and all collaborator invitations are
    re-sent (GitHub ignores duplicates).
    """
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

    # Prefer the group-specific repo URL (only set after GitHub repo is actually created).
    # Fall back to the user's personal repo URL — never use projects.internx_repo_url
    # because it may hold a stale hardcoded value from before the multiplayer system.
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