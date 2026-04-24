import random
import uuid
from datetime import date, datetime, timedelta, timezone

from app.core.database import db

ACTIVE_MEMBER_STATUSES = {"active"}
ACTIVE_COHORT_STATUSES = {"forming", "active"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _active_membership_rows(user_id: str) -> list[dict]:
    result = db.table("project_members").select("*").eq("user_id", user_id).execute()
    rows = result.data or []
    return [row for row in rows if row.get("status") in ACTIVE_MEMBER_STATUSES]


def get_active_assignment(user_id: str) -> dict | None:
    memberships = sorted(
        _active_membership_rows(user_id),
        key=lambda row: row.get("joined_at") or "",
        reverse=True,
    )
    for member in memberships:
        cohort_result = db.table("project_cohorts").select("*").eq("id", member["cohort_id"]).single().execute()
        cohort = cohort_result.data
        if not cohort or cohort.get("status") not in ACTIVE_COHORT_STATUSES:
            continue

        project_result = db.table("projects").select("*").eq("id", cohort["project_id"]).single().execute()
        project = project_result.data
        if not project:
            continue

        return {
            "member": member,
            "cohort": cohort,
            "project": project,
        }
    return None


def _default_role_slot(project_id: str, role: str) -> dict:
    return {
        "project_id": project_id,
        "role": role,
        "min_members": 1,
        "max_members": 1,
    }


def get_project_role_slots(project_id: str) -> list[dict]:
    result = db.table("project_roles").select("*").eq("project_id", project_id).execute()
    return result.data or []


def _get_role_slot(project_id: str, role: str) -> dict:
    for slot in get_project_role_slots(project_id):
        if slot.get("role") == role:
            return slot
    return _default_role_slot(project_id, role)


def _role_member_count(cohort_id: str, role: str) -> int:
    result = db.table("project_members").select("id, status").eq("cohort_id", cohort_id).eq("role", role).execute()
    rows = result.data or []
    return len([row for row in rows if row.get("status") in ACTIVE_MEMBER_STATUSES])


def _find_joinable_cohort(project_id: str, role: str) -> dict | None:
    slot = _get_role_slot(project_id, role)
    result = db.table("project_cohorts").select("*").eq("project_id", project_id).execute()
    cohorts = result.data or []
    cohorts = [
        row for row in cohorts
        if row.get("status") in ACTIVE_COHORT_STATUSES
    ]
    cohorts.sort(key=lambda row: (row.get("created_at") or "", row.get("cohort_number") or 0))

    for cohort in cohorts:
        if _role_member_count(cohort["id"], role) < slot["max_members"]:
            return cohort
    return None


def _create_cohort(project: dict, creator_id: str) -> dict:
    result = db.table("project_cohorts").select("cohort_number").eq("project_id", project["id"]).execute()
    existing = result.data or []
    next_number = max([row.get("cohort_number", 0) for row in existing], default=0) + 1
    insert = {
        "project_id": project["id"],
        "cohort_number": next_number,
        "status": "forming",
        "created_by": creator_id,
    }
    created = db.table("project_cohorts").insert(insert).execute()
    return created.data[0]


def _ensure_active_sprint(project_id: str, cohort_id: str, creator_id: str) -> dict:
    sprint_result = db.table("sprints").select("*").eq("cohort_id", cohort_id).eq("is_active", True).limit(1).execute()
    if sprint_result.data:
        return sprint_result.data[0]

    start = _today()
    end = start + timedelta(days=14)
    created = db.table("sprints").insert({
        "project_id": project_id,
        "cohort_id": cohort_id,
        "title": "Sprint 1",
        "description": "Active sprint for the assigned InternX cohort.",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "is_active": True,
        "created_by": creator_id,
    }).execute()
    return created.data[0]


def _ensure_member_assignment(cohort: dict, user: dict) -> dict:
    existing = db.table("project_members").select("*").eq("cohort_id", cohort["id"]).eq("user_id", user["id"]).limit(1).execute()
    if existing.data:
        return existing.data[0]

    github_branch = (
        user.get("github_username")
        or user.get("name", "intern").lower().replace(" ", "-")
    )
    payload = {
        "cohort_id": cohort["id"],
        "user_id": user["id"],
        "role": user["intern_role"],
        "status": "active",
        "github_branch": f"{github_branch}-{user['intern_role']}",
    }
    created = db.table("project_members").insert(payload).execute()
    return created.data[0]


def _clone_template_tasks(project_id: str, cohort_id: str, sprint_id: str, user_id: str, role: str) -> None:
    existing = db.table("tasks").select("id").eq("cohort_id", cohort_id).eq("assigned_to", user_id).execute()
    if existing.data:
        return

    template_result = (
        db.table("tasks")
        .select("*")
        .eq("project_id", project_id)
        .is_("cohort_id", "null")
        .is_("assigned_to", "null")
        .eq("intern_role", role)
        .execute()
    )
    templates = template_result.data or []
    if not templates:
        return

    now = _utc_now()
    rows = []
    for template in templates:
        rows.append({
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "cohort_id": cohort_id,
            "sprint_id": sprint_id,
            "template_task_id": template["id"],
            "title": template["title"],
            "description": template.get("description"),
            "assigned_to": user_id,
            "intern_role": role,
            "status": "todo",
            "priority": template.get("priority", "medium"),
            "due_date": template.get("due_date"),
            "resources": template.get("resources"),
            "created_by": template.get("created_by"),
            "created_at": now,
            "updated_at": now,
        })

    db.table("tasks").insert(rows).execute()


def _project_ids_for_role(role: str) -> list[str]:
    role_rows = db.table("project_roles").select("project_id").eq("role", role).execute().data or []
    project_ids = [row["project_id"] for row in role_rows]
    if project_ids:
        return project_ids

    fallback = db.table("projects").select("id").eq("intern_role", role).eq("is_active", True).execute().data or []
    return [row["id"] for row in fallback]


def assign_user_to_project(user: dict) -> dict:
    existing = get_active_assignment(user["id"])
    if existing:
        sprint = _ensure_active_sprint(existing["project"]["id"], existing["cohort"]["id"], user["id"])
        _clone_template_tasks(existing["project"]["id"], existing["cohort"]["id"], sprint["id"], user["id"], existing["member"]["role"])
        return existing

    project_ids = _project_ids_for_role(user["intern_role"])
    if not project_ids:
        return None

    projects = []
    for project_id in project_ids:
        project_result = db.table("projects").select("*").eq("id", project_id).single().execute()
        if project_result.data and project_result.data.get("is_active", True):
            projects.append(project_result.data)

    random.shuffle(projects)
    chosen_project = None
    chosen_cohort = None
    for project in projects:
        cohort = _find_joinable_cohort(project["id"], user["intern_role"])
        if cohort:
            chosen_project = project
            chosen_cohort = cohort
            break

    if not chosen_project:
        chosen_project = projects[0]
        chosen_cohort = _create_cohort(chosen_project, user["id"])

    member = _ensure_member_assignment(chosen_cohort, user)
    sprint = _ensure_active_sprint(chosen_project["id"], chosen_cohort["id"], user["id"])
    _clone_template_tasks(chosen_project["id"], chosen_cohort["id"], sprint["id"], user["id"], member["role"])
    return {
        "project": chosen_project,
        "cohort": chosen_cohort,
        "member": member,
    }


def assignment_project_payload(assignment: dict) -> dict:
    project = dict(assignment["project"])
    member = assignment["member"]
    cohort = assignment["cohort"]
    project["project_id"] = project["id"]
    project["cohort_id"] = cohort["id"]
    project["team_role"] = member["role"]
    project["user_repo_url"] = member.get("github_repo_url") or ""
    project["official_repo_url"] = cohort.get("repo_url") or ""
    project["cohort_status"] = cohort.get("status")
    return project
