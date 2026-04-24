"""
github_service.py
─────────────────
Manages the internx GitHub organisation:
  • Creates a repo under the org when a project group is fully staffed
  • Repo name is unique per group: {project-slug}-g{short-group-id}
    so the same project can run as multiple groups without collision
  • Invites all team members as collaborators (push access)
  • Returns the repo URL to store in project_groups.repo_url

Requirements in .env:
  GITHUB_ORG_TOKEN   – PAT with scopes: repo, admin:org, write:org
  GITHUB_ORG         – org name (default: "internx-hub")
"""

import re
import httpx
from app.core.config import settings


GITHUB_API = "https://api.github.com"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.github_org_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _slugify(text: str) -> str:
    """Turn a project title into a valid GitHub repo slug."""
    slug = text.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug.strip())
    slug = re.sub(r"-+", "-", slug)
    return slug[:80]   # leave room for the group suffix


def build_repo_name(project_title: str, group_id: str) -> str:
    """
    Build a unique repo name for a specific group of a project.

    Pattern:  {project-slug}-g{first-8-chars-of-group-uuid}
    Example:  ecommerce-platform-g3f2a1b0

    This guarantees:
      - Same project running as cohort-1, cohort-2, cohort-N all get different repos
      - Repo names stay human-readable
      - No collisions even if two groups form at the same millisecond
    """
    slug   = _slugify(project_title)
    suffix = group_id.replace("-", "")[:8]   # 8 hex chars = 4 billion combinations
    return f"{slug}-g{suffix}"


# ─── Repo Management ─────────────────────────────────────────────────────────

def create_org_repo(
    repo_name: str,
    project_description: str,
    tech_stack: list[str],
    private: bool = False,
) -> dict:
    """
    Create a new repo under the internx GitHub org.

    Args:
        repo_name:           Already-computed unique name (use build_repo_name()).
        project_description: Short description for the repo.
        tech_stack:          List of technologies shown in the description.
        private:             Whether the repo should be private.

    Returns:
        {"html_url": "https://github.com/internx-hub/...", "full_name": "internx-hub/..."}

    Raises:
        httpx.HTTPStatusError on failure
    """
    org = settings.github_org

    tech_str    = ", ".join(tech_stack) if tech_stack else ""
    description = f"[InternX] {project_description[:200]}"
    if tech_str:
        description += f" | Stack: {tech_str}"

    payload = {
        "name":         repo_name,
        "description":  description,
        "private":      private,
        "auto_init":    True,           # creates README so repo is non-empty
        "has_issues":   True,
        "has_projects": False,
        "has_wiki":     False,
    }

    with httpx.Client(timeout=15) as client:
        resp = client.post(
            f"{GITHUB_API}/orgs/{org}/repos",
            headers=_headers(),
            json=payload,
        )

        # 422 = repo name already exists — fetch it instead of crashing
        if resp.status_code == 422:
            existing = client.get(
                f"{GITHUB_API}/repos/{org}/{repo_name}",
                headers=_headers(),
            )
            existing.raise_for_status()
            data = existing.json()
        else:
            resp.raise_for_status()
            data = resp.json()

    return {
        "html_url":  data["html_url"],
        "full_name": data["full_name"],
        "name":      data["name"],
    }


def add_collaborator(repo_full_name: str, github_username: str, permission: str = "push") -> bool:
    """
    Add a GitHub user as a collaborator to an org repo.
    permission: "pull" | "push" | "admin"

    Returns True on success, False if user not found on GitHub.
    """
    with httpx.Client(timeout=10) as client:
        resp = client.put(
            f"{GITHUB_API}/repos/{repo_full_name}/collaborators/{github_username}",
            headers=_headers(),
            json={"permission": permission},
        )
        if resp.status_code in (201, 204):
            return True
        if resp.status_code == 404:
            return False
        resp.raise_for_status()
    return False


def add_team_collaborators(repo_full_name: str, github_usernames: list[str]) -> dict:
    """
    Invite all team members to the repo.
    Returns {"invited": [...], "failed": [...]}
    """
    invited, failed = [], []
    for username in github_usernames:
        if not username:
            continue
        ok = add_collaborator(repo_full_name, username)
        (invited if ok else failed).append(username)
    return {"invited": invited, "failed": failed}


def create_branch_protection(repo_full_name: str, branch: str = "main") -> bool:
    """
    Add basic branch protection: require PRs, no direct pushes to main.
    Non-fatal if it fails (requires admin token scope).
    """
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.put(
                f"{GITHUB_API}/repos/{repo_full_name}/branches/{branch}/protection",
                headers=_headers(),
                json={
                    "required_status_checks": None,
                    "enforce_admins": False,
                    "required_pull_request_reviews": {
                        "required_approving_review_count": 1,
                        "dismiss_stale_reviews": False,
                    },
                    "restrictions": None,
                },
            )
            return resp.status_code in (200, 201)
    except Exception:
        return False


def setup_project_repo(
    project_title: str,
    group_id: str,
    project_description: str,
    tech_stack: list[str],
    github_usernames: list[str],
) -> dict:
    """
    Full repo setup for a newly activated project group:
      1. Build a unique repo name:  {project-slug}-g{group-short-id}
      2. Create the org repo
      3. Invite all team members as collaborators
      4. Add branch protection on main
      5. Return the repo URL

    Args:
        project_title:       Used to generate the human-readable slug.
        group_id:            UUID of the project_groups row — appended as suffix
                             to make the name unique across multiple groups.
        project_description: Shown in the GitHub repo description.
        tech_stack:          List of tech strings.
        github_usernames:    GitHub usernames of all team members.

    Returns:
        {
          "repo_name":  "ecommerce-platform-g3f2a1b0",
          "repo_url":   "https://github.com/internx-hub/ecommerce-platform-g3f2a1b0",
          "full_name":  "internx-hub/ecommerce-platform-g3f2a1b0",
          "invited":    ["alice", "bob"],
          "failed":     []
        }
    """
    repo_name  = build_repo_name(project_title, group_id)
    repo_info  = create_org_repo(repo_name, project_description, tech_stack)
    collabs    = add_team_collaborators(repo_info["full_name"], github_usernames)
    create_branch_protection(repo_info["full_name"])   # best-effort

    return {
        "repo_name":  repo_info["name"],
        "repo_url":   repo_info["html_url"],
        "full_name":  repo_info["full_name"],
        "invited":    collabs["invited"],
        "failed":     collabs["failed"],
    }


# ─── Utility ─────────────────────────────────────────────────────────────────

def get_org_repo(repo_full_name: str) -> dict | None:
    """Fetch a repo's details. Returns None if not found."""
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{GITHUB_API}/repos/{repo_full_name}", headers=_headers())
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()
    except Exception:
        return None