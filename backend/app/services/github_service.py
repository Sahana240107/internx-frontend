"""
github_service.py
"""

import re
import os
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
    slug = text.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug.strip())
    slug = re.sub(r"-+", "-", slug)
    return slug[:80]


def build_repo_name(project_title: str, group_id: str) -> str:
    slug   = _slugify(project_title)
    suffix = group_id.replace("-", "")[:8]
    return f"{slug}-g{suffix}"


def create_org_repo(
    repo_name: str,
    project_description: str,
    tech_stack: list[str],
    private: bool = False,
) -> dict:
    org = settings.github_org
    tech_str    = ", ".join(tech_stack) if tech_stack else ""
    description = f"[InternX] {project_description[:200]}"
    if tech_str:
        description += f" | Stack: {tech_str}"

    payload = {
        "name":         repo_name,
        "description":  description,
        "private":      private,
        "auto_init":    True,
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
    invited, failed = [], []
    for username in github_usernames:
        if not username:
            continue
        ok = add_collaborator(repo_full_name, username)
        (invited if ok else failed).append(username)
    return {"invited": invited, "failed": failed}


def create_branch_protection(repo_full_name: str, branch: str = "main") -> bool:
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
    repo_name = build_repo_name(project_title, group_id)
    repo_info = create_org_repo(repo_name, project_description, tech_stack)
    collabs   = add_team_collaborators(repo_info["full_name"], github_usernames)
    create_branch_protection(repo_info["full_name"])

    return {
        "repo_name": repo_info["name"],
        "repo_url":  repo_info["html_url"],
        "full_name": repo_info["full_name"],
        "invited":   collabs["invited"],
        "failed":    collabs["failed"],
    }


def _parse_pr_url(pr_url: str) -> tuple[str, int] | tuple[None, None]:
    match = re.search(r"github\.com/([^/]+/[^/]+)/pull/(\d+)", pr_url)
    if not match:
        return None, None
    return match.group(1), int(match.group(2))


def check_pr_mergeable(pr_url: str) -> bool | None:
    # ── Token check (inside the function, not at module level) ──
    token_present = bool(getattr(settings, "github_org_token", None))
    print(f"[GITHUB] check_pr_mergeable: token present={token_present}")
    if not token_present:
        print("[GITHUB] ⚠️  No GitHub token — skipping merge check, returning None")
        return None

    repo_full_name, pr_number = _parse_pr_url(pr_url)
    if not repo_full_name:
        print(f"[GITHUB] check_pr_mergeable: could not parse PR URL: {pr_url}")
        return None

    import time as _time

    for attempt in range(3):
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.get(
                    f"{GITHUB_API}/repos/{repo_full_name}/pulls/{pr_number}",
                    headers=_headers(),
                )
                if resp.status_code == 404:
                    print(f"[GITHUB] PR {pr_url} not found")
                    return None
                resp.raise_for_status()
                pr = resp.json()

                state = pr.get("state")
                if state == "closed":
                    merged = pr.get("merged", False)
                    print(f"[GITHUB] PR {pr_number} is closed (merged={merged})")
                    return True if merged else None

                mergeable = pr.get("mergeable")
                if mergeable is None:
                    print(f"[GITHUB] Mergeable is null (attempt {attempt+1}/3), retrying...")
                    _time.sleep(2 * (attempt + 1))
                    continue

                print(f"[GITHUB] PR {pr_number} mergeable={mergeable}")
                return bool(mergeable)

        except Exception as e:
            print(f"[GITHUB] check_pr_mergeable error (attempt {attempt+1}): {e}")
            if attempt == 2:
                return None
            _time.sleep(2)

    print(f"[GITHUB] Exhausted retries checking mergeability for PR {pr_number}")
    return None


def merge_pr_squash(pr_url: str, task_title: str, commit_message: str = "") -> dict:
    # ── Token check (inside the function, not at module level) ──
    token_present = bool(getattr(settings, "github_org_token", None))
    print(f"[GITHUB] merge_pr_squash: token present={token_present}")
    if not token_present:
        return {
            "success": False,
            "sha":     None,
            "message": "No GitHub token configured — merge skipped",
        }

    repo_full_name, pr_number = _parse_pr_url(pr_url)
    if not repo_full_name:
        return {
            "success": False,
            "sha":     None,
            "message": f"Could not parse PR URL: {pr_url}",
        }

    commit_title = f"[InternX] {task_title[:100]}" if task_title else f"Squash merge PR #{pr_number}"
    body = commit_message or f"Auto-merged by InternX after passing AI code review.\n\nPR: {pr_url}"

    try:
        with httpx.Client(timeout=20) as client:
            resp = client.put(
                f"{GITHUB_API}/repos/{repo_full_name}/pulls/{pr_number}/merge",
                headers=_headers(),
                json={
                    "merge_method":   "squash",
                    "commit_title":   commit_title,
                    "commit_message": body,
                },
            )

            if resp.status_code == 200:
                data = resp.json()
                sha = data.get("sha", "")
                print(f"[GITHUB] ✅ Squash-merged PR #{pr_number} → sha={sha[:8]}")
                return {"success": True, "sha": sha, "message": "Merged successfully"}

            if resp.status_code == 405:
                detail = resp.json().get("message", "Method Not Allowed")
                print(f"[GITHUB] ❌ PR #{pr_number} not mergeable: {detail}")
                return {"success": False, "sha": None, "message": detail}

            if resp.status_code == 409:
                print(f"[GITHUB] ❌ PR #{pr_number} merge conflict (409)")
                return {
                    "success": False,
                    "sha":     None,
                    "message": "Merge conflict: your branch is out of sync. Pull from base and push again.",
                }

            if resp.status_code == 422:
                data = resp.json()
                print(f"[GITHUB] ❌ PR #{pr_number} unprocessable: {data}")
                return {"success": False, "sha": None, "message": data.get("message", "Unprocessable")}

            resp.raise_for_status()
            return {"success": False, "sha": None, "message": f"Unexpected status {resp.status_code}"}

    except Exception as e:
        print(f"[GITHUB] merge_pr_squash exception: {e}")
        return {"success": False, "sha": None, "message": str(e)}


def get_org_repo(repo_full_name: str) -> dict | None:
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{GITHUB_API}/repos/{repo_full_name}", headers=_headers())
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()
    except Exception:
        return None