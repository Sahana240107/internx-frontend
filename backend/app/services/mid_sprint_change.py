"""
backend/app/services/mid_sprint_change.py
──────────────────────────────────────────
Mid-Sprint Requirement Change Simulation

How it works:
  1. When an intern marks a task as "done", a background job is scheduled.
  2. After a random delay (5–10 minutes), ONE task per intern per sprint is
     randomly selected and "changed" — its description is updated, status is
     reset to "in_progress", and a notification is sent to the intern.
  3. A `mid_sprint_changed` flag on the task prevents double-triggering.

Role-specific change templates make changes feel authentic:
  - frontend  → UI/client requirement changes (new designs, responsiveness)
  - backend   → API contract/schema changes (new fields, endpoints)
  - design    → stakeholder feedback requiring redesign
  - tester    → scope changes requiring new test cases
  - fullstack → mixed changes
  - devops    → infrastructure/deployment changes
"""

import random
import logging
from datetime import datetime, timezone

from app.core.database import supabase_admin
from app.routers.notifications import upsert_notification

logger = logging.getLogger(__name__)


# ─── Role-Specific Change Templates ──────────────────────────────────────────

CHANGE_TEMPLATES = {
    "frontend": [
        {
            "prefix": "🔄 [REQUIREMENT CHANGE] Client requested UI update: ",
            "addition": (
                "\n\n⚠️ MID-SPRINT CHANGE (from Product Manager):\n"
                "The client reviewed the mockups and requested changes. You must now:\n"
                "• Update the component to match the new responsive breakpoints (mobile-first)\n"
                "• Change the primary color scheme to match the updated brand guidelines\n"
                "• Add a loading skeleton state while data is being fetched\n"
                "• Ensure WCAG 2.1 AA accessibility compliance (aria-labels, contrast ratios)\n"
                "Please update your implementation accordingly and re-submit for review."
            ),
            "reason": "Client requested UI overhaul after design review meeting.",
        },
        {
            "prefix": "🔄 [REQUIREMENT CHANGE] New API response structure: ",
            "addition": (
                "\n\n⚠️ MID-SPRINT CHANGE (from Backend Team):\n"
                "The API response structure has changed. You must now:\n"
                "• Update the data-fetching logic to handle the new response shape\n"
                "• The `data` field is now nested under `result.payload.data`\n"
                "• Add error boundary handling for the new `errorCode` field\n"
                "• Update TypeScript interfaces/types to match the new contract\n"
                "Check the updated API docs in Notion and adjust your implementation."
            ),
            "reason": "Backend team updated API contract mid-sprint.",
        },
        {
            "prefix": "🔄 [REQUIREMENT CHANGE] Performance requirement added: ",
            "addition": (
                "\n\n⚠️ MID-SPRINT CHANGE (from Tech Lead):\n"
                "Performance benchmarks have been introduced. You must now:\n"
                "• Implement React.memo or useMemo to prevent unnecessary re-renders\n"
                "• Add virtualization for lists with more than 50 items\n"
                "• Lazy-load heavy components using React.lazy + Suspense\n"
                "• Ensure Lighthouse performance score is above 85\n"
                "Profile your component before and after optimizations."
            ),
            "reason": "Stakeholder flagged performance issues in staging.",
        },
    ],
    "backend": [
        {
            "prefix": "🔄 [REQUIREMENT CHANGE] API contract updated: ",
            "addition": (
                "\n\n⚠️ MID-SPRINT CHANGE (from Frontend Team):\n"
                "The frontend team needs changes to the API response. You must now:\n"
                "• Add pagination support: return `{ data, total, page, limit }` shape\n"
                "• Include a `meta.request_id` field in every response for tracing\n"
                "• Add filtering via query params (`?status=active&role=frontend`)\n"
                "• Ensure all endpoints return 422 with validation details on bad input\n"
                "Update the Pydantic schemas and route handlers accordingly."
            ),
            "reason": "Frontend team needs paginated + filterable responses.",
        },
        {
            "prefix": "🔄 [REQUIREMENT CHANGE] Security requirements added: ",
            "addition": (
                "\n\n⚠️ MID-SPRINT CHANGE (from Security Review):\n"
                "Security audit flagged issues. You must now:\n"
                "• Add rate limiting: max 100 requests/minute per user using slowapi\n"
                "• Sanitize all user inputs to prevent SQL injection\n"
                "• Add request logging with user_id, timestamp, and endpoint\n"
                "• Implement idempotency keys for POST/PATCH endpoints\n"
                "Review OWASP top 10 and apply fixes before re-submitting."
            ),
            "reason": "Security audit flagged vulnerabilities in staging.",
        },
        {
            "prefix": "🔄 [REQUIREMENT CHANGE] Database schema change: ",
            "addition": (
                "\n\n⚠️ MID-SPRINT CHANGE (from DB Architect):\n"
                "The database schema has been updated. You must now:\n"
                "• The `status` column is now an enum — update queries accordingly\n"
                "• A new `audit_log` trigger has been added — test that inserts still work\n"
                "• Add a composite index on (user_id, created_at) for performance\n"
                "• Update your migration script and test with a fresh DB seed\n"
                "Check the updated schema.sql and align your queries."
            ),
            "reason": "DBA updated schema after capacity planning session.",
        },
    ],
    "design": [
        {
            "prefix": "🔄 [REQUIREMENT CHANGE] Stakeholder redesign request: ",
            "addition": (
                "\n\n⚠️ MID-SPRINT CHANGE (from Stakeholder Feedback):\n"
                "After the design review, stakeholders requested changes. You must now:\n"
                "• Redesign the layout to use a card-based grid instead of a list view\n"
                "• Update the color palette — primary is now #6366F1 (indigo), not blue\n"
                "• Add micro-interactions: hover states, transition animations (200ms ease)\n"
                "• Create a dark mode variant and document color tokens in the design system\n"
                "Update your Figma file and export updated specs for the dev team."
            ),
            "reason": "Stakeholders requested visual refresh after competitor analysis.",
        },
        {
            "prefix": "🔄 [REQUIREMENT CHANGE] Accessibility overhaul required: ",
            "addition": (
                "\n\n⚠️ MID-SPRINT CHANGE (from Accessibility Audit):\n"
                "An a11y audit found critical issues. You must now:\n"
                "• Redesign interactive elements to meet 44x44px minimum touch target size\n"
                "• Ensure all text has a contrast ratio of at least 4.5:1 (WCAG AA)\n"
                "• Add focus-visible states to all interactive components\n"
                "• Document keyboard navigation flow in the Figma prototype\n"
                "Run the design through Figma's Accessibility plugin before resubmitting."
            ),
            "reason": "Accessibility audit required before public launch.",
        },
    ],
    "tester": [
        {
            "prefix": "🔄 [REQUIREMENT CHANGE] Feature scope expanded: ",
            "addition": (
                "\n\n⚠️ MID-SPRINT CHANGE (from QA Lead):\n"
                "The feature scope has expanded. You must now update test cases:\n"
                "• Add edge case tests: empty state, max character limits, special characters\n"
                "• Write regression tests for the 3 previously reported bugs (JIRA: BUG-42, 43, 51)\n"
                "• Add API contract tests to verify response schema hasn't broken\n"
                "• Update the test matrix to include Safari and Firefox cross-browser checks\n"
                "Ensure test coverage stays above 80% after the scope change."
            ),
            "reason": "Feature scope expanded after stakeholder sprint review.",
        },
        {
            "prefix": "🔄 [REQUIREMENT CHANGE] New acceptance criteria added: ",
            "addition": (
                "\n\n⚠️ MID-SPRINT CHANGE (from Product Owner):\n"
                "The acceptance criteria have been updated. You must now:\n"
                "• Add performance tests: page load must be < 2s under 100 concurrent users\n"
                "• Write security test cases: SQL injection, XSS, and CSRF scenarios\n"
                "• Update the test plan to include negative test cases (invalid inputs)\n"
                "• Add smoke tests that run on every deployment to catch regressions\n"
                "Re-review the updated user stories before writing the new test cases."
            ),
            "reason": "PO updated acceptance criteria after legal review.",
        },
    ],
    "fullstack": [
        {
            "prefix": "🔄 [REQUIREMENT CHANGE] Full-stack scope change: ",
            "addition": (
                "\n\n⚠️ MID-SPRINT CHANGE (from Tech Lead):\n"
                "The feature requirements have expanded. You must now:\n"
                "• Add real-time updates using WebSockets (or Supabase Realtime)\n"
                "• Implement optimistic UI updates on the frontend\n"
                "• Add a background job to process data asynchronously on the backend\n"
                "• Write integration tests covering both frontend and backend together\n"
                "Discuss the approach with your team lead before implementing."
            ),
            "reason": "Client requested real-time capability after competitor demo.",
        },
    ],
    "devops": [
        {
            "prefix": "🔄 [REQUIREMENT CHANGE] Infrastructure requirement change: ",
            "addition": (
                "\n\n⚠️ MID-SPRINT CHANGE (from Infrastructure Team):\n"
                "Cloud cost review triggered requirement changes. You must now:\n"
                "• Update the Docker image to use a multi-stage build (reduce size by 60%)\n"
                "• Add health check endpoints and configure liveness/readiness probes\n"
                "• Set up log aggregation and ship logs to the centralized logging service\n"
                "• Add auto-scaling rules: scale out at 70% CPU, scale in at 30% CPU\n"
                "Update the deployment manifests and test in the staging environment."
            ),
            "reason": "Cost optimization initiative from infrastructure team.",
        },
    ],
}

# Fallback for unknown roles
CHANGE_TEMPLATES["default"] = CHANGE_TEMPLATES["fullstack"]


# ─── Core Logic ───────────────────────────────────────────────────────────────

def _get_role_templates(role: str) -> list:
    """Get change templates for a given role, falling back to default."""
    role_lower = (role or "").lower()
    return CHANGE_TEMPLATES.get(role_lower, CHANGE_TEMPLATES["default"])


def _pick_random_change(role: str) -> dict:
    """Pick a random change template for the given role."""
    templates = _get_role_templates(role)
    return random.choice(templates)


def get_eligible_task_for_change(user_id: str, sprint_id: str) -> dict | None:
    """
    Find ONE eligible task for mid-sprint change for the given user + sprint.

    Eligible = task is assigned to the user, in this sprint, has status 'done',
    and has NOT already been mid-sprint-changed (mid_sprint_changed = false/null).

    Returns the task dict or None if no eligible task found.
    """
    try:
        result = (
            supabase_admin.table("tasks")
            .select("id, title, description, status, intern_role, sprint_id, assigned_to")
            .eq("assigned_to", user_id)
            .eq("sprint_id", sprint_id)
            .eq("status", "done")
            .eq("mid_sprint_changed", False)
            .limit(20)
            .execute()
        )
        tasks = result.data or []
        if not tasks:
            return None
        return random.choice(tasks)
    except Exception as e:
        logger.error(f"get_eligible_task_for_change failed user={user_id} sprint={sprint_id}: {e}")
        return None


def apply_mid_sprint_change(task: dict, role: str) -> dict | None:
    """
    Apply a mid-sprint requirement change to a task:
      1. Pick a role-appropriate change template
      2. Update the task: append change details to description, reset status to 'in_progress'
      3. Mark the task as mid_sprint_changed = True (prevents re-triggering)
      4. Send a notification to the intern
      5. Return the updated task

    Returns None on failure.
    """
    task_id = task["id"]
    user_id = task["assigned_to"]
    original_title = task.get("title", "Your task")
    original_desc = task.get("description", "")

    change = _pick_random_change(role)

    new_description = original_desc + change["addition"]

    try:
        # Update the task in DB
        update_res = (
            supabase_admin.table("tasks")
            .update({
                "description": new_description,
                "status": "in_progress",
                "mid_sprint_changed": True,
                "mid_sprint_change_reason": change["reason"],
                "mid_sprint_changed_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", task_id)
            .execute()
        )

        if not update_res.data:
            logger.error(f"apply_mid_sprint_change: DB update returned no data for task {task_id}")
            return None

        updated_task = update_res.data[0]
        logger.info(f"apply_mid_sprint_change: task {task_id} changed for user {user_id}")

        # Send notification to the intern
        upsert_notification(
            user_id=user_id,
            key=f"mid_sprint_change_{task_id}",
            type_="mid_sprint_change",
            title="⚠️ Requirement Change!",
            body=f'Your completed task "{original_title}" has new requirements. Please revisit it.',
            icon="⚠️",
            href="/dashboard",
            count=1,
        )

        return updated_task

    except Exception as e:
        logger.error(f"apply_mid_sprint_change failed task={task_id}: {e}", exc_info=True)
        return None


def check_and_trigger_mid_sprint_change(user_id: str, sprint_id: str, role: str) -> dict:
    """
    Main entry point — called by the background task after a task is marked done.

    Logic:
      1. Check how many mid-sprint changes have already been applied this sprint
         (we limit to 1 per intern per sprint)
      2. If none yet, pick an eligible done task and apply the change
      3. Return a summary dict

    Returns:
      { "triggered": bool, "task_id": str | None, "reason": str }
    """
    try:
        # Check if a change was already applied this sprint for this user
        already_changed = (
            supabase_admin.table("tasks")
            .select("id")
            .eq("assigned_to", user_id)
            .eq("sprint_id", sprint_id)
            .eq("mid_sprint_changed", True)
            .execute()
        )

        if already_changed.data:
            return {
                "triggered": False,
                "task_id": None,
                "reason": "Mid-sprint change already applied for this sprint.",
            }

        # Pick an eligible task
        task = get_eligible_task_for_change(user_id, sprint_id)
        if not task:
            return {
                "triggered": False,
                "task_id": None,
                "reason": "No eligible done tasks found for mid-sprint change.",
            }

        # Apply the change
        updated = apply_mid_sprint_change(task, role)
        if not updated:
            return {
                "triggered": False,
                "task_id": task["id"],
                "reason": "Failed to apply mid-sprint change.",
            }

        return {
            "triggered": True,
            "task_id": task["id"],
            "reason": "Mid-sprint requirement change applied successfully.",
        }

    except Exception as e:
        logger.error(f"check_and_trigger_mid_sprint_change failed: {e}", exc_info=True)
        return {
            "triggered": False,
            "task_id": None,
            "reason": f"Error: {str(e)}",
        }