"""
backend/app/services/adaptive_engine.py
========================================
Adaptive Difficulty Engine — Pool-Based Sprint Task Assignment

Workflow (exactly as specified):
─────────────────────────────────
Project
└── Per-team sprint track  (team = same project_id + group_id + intern_role)
      Sprint 0 → Sprint 1 → Sprint 2 …

Pool per sprint per team:
  pool_size = ceil(member_count × 3.5)
  ~43% easy | ~43% medium | ~14% hard

Initial assignment when sprint starts:
  Every intern gets exactly 2 tasks: 1 easy + 1 medium
  Remaining tasks sit UNASSIGNED in the pool

Mid-sprint adaptive assignment:
  Intern marks task done → todo list empty?
    Yes → compute score → pick 1 task from pool matching difficulty → assign
    Repeat until pool exhausted

Score formula:
  base         = avg PR score across done tasks (0–100)
  time_bonus   = +10 if submitted before due_date, −5 if late  (per task)
  resubmit_pen = −8 per extra PR attempt beyond first           (per task)
  final        = clamp(base + time_bonus − resubmit_pen, 0, 100)
  0–40  → easy | 41–70 → medium | 71–100 → hard

Sprint advance:
  Pool exhausted for an intern AND all teammates' assigned tasks are done
  → deactivate current sprint, create next sprint, build new pool,
    assign 1 easy + 1 medium to every team member, activate new sprint

FIXES in this version:
─────────────────────
  FIX 1 — _pick_from_pool now requires intern_role filter.
           Old code picked ANY unassigned task in the sprint regardless of
           intern_role — a backend intern could be assigned a frontend task.
           Fix: intern_role passed through from all callers and applied as a
           filter in the DB query.

  FIX 2 — build_task_pool Source 1 template search now handles NULL intern_role.
           Old code filtered by .eq("intern_role", intern_role) — if the 6
           seeded/template tasks were inserted without intern_role set, zero
           tasks were found, the pool was empty, and assign_initial_tasks
           assigned nothing. Sprint activated with zero tasks.
           Fix: Two-pass search — first with intern_role filter, then without
           if the first pass finds nothing. Matched tasks are stamped with the
           correct intern_role before being added to the sprint pool.

  FIX 3 — _advance_sprint_for_team race condition.
           Old code: two team members completing their last task simultaneously
           both passed _is_sprint_complete_for_team → both deactivated the
           sprint → both called get_or_create_role_sprint → duplicate next
           sprints created.
           Fix: After deactivating the current sprint, re-check whether the
           next sprint already exists AND is active (another thread beat us).
           If so, skip creation and skip pool building — just ensure this
           intern gets their initial tasks on the already-active sprint.

  FIX 4 — get_or_create_role_sprint Sprint-0 fallback was scoping by
           project only, so every role adopted the same sprint and task pools
           merged across roles. Now fallback also requires group_id match AND
           filters by intern_role in the title when possible, or creates a
           fresh role-scoped sprint if no suitable one exists.

  FIX 5 — assign_initial_tasks was idempotent per-difficulty but NOT
           per-count: it only skipped a difficulty already assigned. When
           called a second time for a new team member the pool already had
           one intern's tasks assigned, so the second intern would still get
           two more tasks — giving the first intern 2 and second intern 2 is
           correct, but if called again (e.g. on re-initialise) the already-
           assigned intern could receive duplicate tasks. Now we hard-limit:
           if the intern already has ≥ 2 assigned tasks in the sprint, skip
           entirely.

  FIX 6 — build_task_pool "already full" guard compared unassigned count
           against pool_size but ignored tasks already assigned to the team.
           A pool of 7 for 2-member team would be considered "full" with 5
           unassigned + 2 assigned — but calling a second time during
           initialise_sprint_for_intern would still insert more tasks because
           the first intern's 2 assigned tasks are no longer in the unassigned
           count. Fixed: guard now compares against total tasks in sprint
           (assigned + unassigned) for this role.

All queries are flat (no nested PostgREST joins) to avoid Cloudflare Error 1101.
"""

import logging
import math
import re
import uuid
import itertools
from datetime import datetime, date, timedelta, timezone

from app.core.database import supabase_admin as db
from app.routers.notifications import upsert_notification

logger = logging.getLogger(__name__)

DIFFICULTY_TIERS = ("easy", "medium", "hard")


# ── Utilities ──────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _pool_split(pool_size: int) -> tuple[int, int, int]:
    """Split pool_size into (easy, medium, hard) counts: ~43% / ~43% / ~14%."""
    n_hard   = max(1, round(pool_size * 0.14))
    n_easy   = round(pool_size * 0.43)
    n_medium = pool_size - n_easy - n_hard
    n_medium = max(0, n_medium)
    n_easy   = max(0, pool_size - n_medium - n_hard)
    return n_easy, n_medium, n_hard


def _get_sprint_number(sprint_title: str) -> int | None:
    m = re.match(r"Sprint\s+(\d+)", sprint_title or "", re.IGNORECASE)
    return int(m.group(1)) if m else None


# ── User context ───────────────────────────────────────────────────────────────

def _get_user_context(user_id: str) -> dict:
    """
    Returns {project_id, group_id, intern_role} for the user.
    Flat queries only — no nested PostgREST selects.
    """
    gm = (
        db.table("group_members")
        .select("group_id, intern_role")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if gm.data:
        row         = gm.data[0]
        group_id    = row.get("group_id")
        intern_role = row.get("intern_role")
        project_id  = None
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
        if project_id:
            return {"project_id": project_id, "group_id": group_id, "intern_role": intern_role}

    # Fallback: profiles table
    prof = (
        db.table("profiles")
        .select("project_id, intern_role")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if prof.data:
        return {
            "project_id":  prof.data[0].get("project_id"),
            "group_id":    None,
            "intern_role": prof.data[0].get("intern_role"),
        }
    return {"project_id": None, "group_id": None, "intern_role": None}


def _count_role_members(project_id: str, group_id: str | None, intern_role: str) -> int:
    """Count members sharing the same group + role (the team)."""
    query = (
        db.table("group_members")
        .select("id", count="exact")
        .eq("intern_role", intern_role)
    )
    if group_id:
        query = query.eq("group_id", group_id)
    else:
        grp = db.table("project_groups").select("id").eq("project_id", project_id).execute()
        gids = [g["id"] for g in (grp.data or [])]
        if gids:
            query = query.in_("group_id", gids)
    result = query.execute()
    return result.count or 1


def _get_role_member_ids(project_id: str, group_id: str | None, intern_role: str) -> list[str]:
    """Return user_ids for the entire team (project + group + role)."""
    query = (
        db.table("group_members")
        .select("user_id")
        .eq("intern_role", intern_role)
    )
    if group_id:
        query = query.eq("group_id", group_id)
    else:
        grp = db.table("project_groups").select("id").eq("project_id", project_id).execute()
        gids = [g["id"] for g in (grp.data or [])]
        if gids:
            query = query.in_("group_id", gids)
    result = query.execute()
    return [r["user_id"] for r in (result.data or [])]


# ── Performance score ──────────────────────────────────────────────────────────

def compute_performance_score(user_id: str, sprint_id: str) -> dict:
    """
    Compute adaptive difficulty score from done tasks in a sprint.

    Formula:
      base         = avg PR score (0–100)
      time_bonus   = +10 on-time, −5 late  (per task)
      resubmit_pen = −8 per extra attempt   (per task)
      final        = clamp(base + time_bonus − resubmit_pen, 0, 100)

    Tier: 0–40 → easy | 41–70 → medium | 71–100 → hard
    """
    tasks_res = (
        db.table("tasks")
        .select("id, score, due_date, updated_at, status")
        .eq("assigned_to", user_id)
        .eq("sprint_id", sprint_id)
        .eq("status", "done")
        .execute()
    )
    tasks = tasks_res.data or []

    if not tasks:
        return {
            "performance_score": 0.0,
            "difficulty_tier":   "easy",
            "breakdown": {
                "avg_task_score":   0.0,
                "time_adjustment":  0,
                "resubmit_penalty": 0,
                "task_count":       0,
            },
        }

    scored    = [t for t in tasks if t.get("score") is not None]
    avg_score = sum(t["score"] for t in scored) / len(scored) if scored else 0.0

    time_adj = 0
    for t in tasks:
        due, done_at = t.get("due_date"), t.get("updated_at")
        if due and done_at:
            try:
                due_dt  = datetime.fromisoformat(due.replace("Z", "+00:00"))
                done_dt = datetime.fromisoformat(done_at.replace("Z", "+00:00"))
                time_adj += 10 if done_dt <= due_dt else -5
            except Exception:
                pass

    resubmit_pen = 0
    task_ids = [t["id"] for t in tasks]
    if task_ids:
        try:
            from collections import Counter
            att = (
                db.table("review_attempts")
                .select("task_id")
                .in_("task_id", task_ids)
                .eq("user_id", user_id)
                .execute()
            )
            for cnt in Counter(a["task_id"] for a in (att.data or [])).values():
                if cnt > 1:
                    resubmit_pen += (cnt - 1) * 8
        except Exception as e:
            logger.warning(f"[AdaptiveEngine] review_attempts fetch failed: {e}")

    final = max(0.0, min(100.0, avg_score + time_adj - resubmit_pen))
    tier  = "easy" if final <= 40 else ("medium" if final <= 70 else "hard")

    return {
        "performance_score": round(final, 2),
        "difficulty_tier":   tier,
        "breakdown": {
            "avg_task_score":   round(avg_score, 2),
            "time_adjustment":  time_adj,
            "resubmit_penalty": -resubmit_pen,
            "task_count":       len(tasks),
        },
    }


# ── Sprint completion ──────────────────────────────────────────────────────────

def _is_sprint_complete_for_team(
    sprint_id: str,
    project_id: str,
    group_id: str | None,
    intern_role: str,
) -> bool:
    """
    Sprint is complete when every ASSIGNED task in the sprint for this team
    (same project + group + role) is 'done'.
    Unassigned pool tasks are ignored — they are reserve tasks.
    """
    team_ids = _get_role_member_ids(project_id, group_id, intern_role)
    if not team_ids:
        return False

    res = (
        db.table("tasks")
        .select("id, status")
        .eq("sprint_id", sprint_id)
        .eq("project_id", project_id)
        .in_("assigned_to", team_ids)
        .execute()
    )
    assigned = res.data or []
    if not assigned:
        return False

    return all(t.get("status") == "done" for t in assigned)


# ── Sprint creation / lookup ───────────────────────────────────────────────────

def get_or_create_role_sprint(
    project_id: str,
    group_id: str | None,
    intern_role: str,
    sprint_number: int,
    created_by: str,
) -> dict:
    """
    Finds or creates a sprint titled "Sprint {N} — {Role}" for this team.

    Search order:
      1. Exact title match scoped to project + group  (new-style sprint)
      2. If sprint_number == 0, adopt ANY sprint scoped to project + group
         that contains the role name in its title (case-insensitive, Python-
         side — no .ilike()). This handles seed sprints titled differently.
      3. If sprint_number == 0 and still no match, create a fresh sprint.
         We do NOT fall back to role-agnostic adoption — that was the root
         cause of all roles sharing the same sprint and the same task pool.
    """
    role_title = intern_role.replace("_", " ").title()
    title      = f"Sprint {sprint_number} — {role_title}"

    # 1. Exact title match scoped to project + group
    query = (
        db.table("sprints")
        .select("*")
        .eq("project_id", project_id)
        .eq("title", title)
    )
    if group_id:
        query = query.eq("group_id", group_id)
    result = query.limit(1).execute()
    if result.data:
        sprint_row = result.data[0]
        # FIX (bug activation): Path 1 used to return the sprint even when
        # is_active=False, leaving the sprint dormant forever if projects.py
        # hit its "already in project" early-return before calling
        # initialise_sprint_for_intern.  Activate it here unconditionally —
        # get_or_create_role_sprint is only called when we *want* a live sprint.
        if not sprint_row.get("is_active"):
            db.table("sprints").update({"is_active": True}).eq("id", sprint_row["id"]).execute()
            sprint_row["is_active"] = True
            logger.info(
                f"[AdaptiveEngine] Activated existing sprint '{title}' "
                f"(was inactive) project={project_id} role={intern_role}"
            )
        return sprint_row

    # 2. Sprint-0 only: adopt an existing sprint whose title contains this role
    #    (Python-side filter — no .ilike() to avoid Cloudflare Error 1101)
    if sprint_number == 0:
        candidates_query = (
            db.table("sprints")
            .select("*")
            .eq("project_id", project_id)
        )
        if group_id:
            candidates_query = candidates_query.eq("group_id", group_id)
        candidates = candidates_query.execute().data or []

        role_needle = intern_role.replace("_", " ").lower()
        # Prefer active sprints first, then inactive
        candidates.sort(key=lambda s: (0 if s.get("is_active") else 1))

        for existing in candidates:
            if role_needle in (existing.get("title") or "").lower():
                # Rename to canonical title so future lookups hit path 1
                db.table("sprints").update({
                    "title":     title,
                    "is_active": True,
                }).eq("id", existing["id"]).execute()
                logger.info(
                    f"[AdaptiveEngine] Adopted sprint '{existing['title']}' "
                    f"→ renamed to '{title}' project={project_id} role={intern_role}"
                )
                existing["title"]     = title
                existing["is_active"] = True
                return existing

        # NOTE: We intentionally do NOT adopt a sprint with the wrong role here.
        # Fall through to create a fresh sprint for this role.

    # 3. Create fresh sprint scoped to this role
    today      = date.today()
    start_date = today + timedelta(weeks=sprint_number * 2)
    end_date   = start_date + timedelta(days=13)

    sprint = db.table("sprints").insert({
        "id":          str(uuid.uuid4()),
        "project_id":  project_id,
        "group_id":    group_id,
        "title":       title,
        "description": f"Adaptive sprint {sprint_number} for {role_title} interns",
        "start_date":  start_date.isoformat(),
        "end_date":    end_date.isoformat(),
        "is_active":   sprint_number == 0,
        "created_by":  created_by,
    }).execute()
    logger.info(
        f"[AdaptiveEngine] Created sprint '{title}' "
        f"project={project_id} group={group_id} role={intern_role}"
    )
    return sprint.data[0]


# ── Pool setup ─────────────────────────────────────────────────────────────────

def _reset_seeded_tasks_to_pool(
    sprint_id: str,
    project_id: str,
    group_id: str | None,
    intern_role: str,
    team_member_ids: list[str],
) -> None:
    """
    When seed data has pre-assigned tasks, unassign them back to the pool
    and stamp them with difficulty so the engine can drip them properly.

    Difficulty assignment for legacy tasks (no difficulty set):
      First 43% → easy, next 43% → medium, last 14% → hard
      (matches _pool_split logic)
    """
    res = (
        db.table("tasks")
        .select("id, difficulty, title")
        .eq("sprint_id", sprint_id)
        .eq("project_id", project_id)
        .in_("assigned_to", team_member_ids)
        .execute()
    )
    seeded = res.data or []
    if not seeded:
        return

    logger.info(
        f"[AdaptiveEngine] Resetting {len(seeded)} seeded tasks to pool "
        f"sprint={sprint_id} role={intern_role}"
    )

    n_easy, n_medium, n_hard = _pool_split(len(seeded))
    difficulties = (
        ["easy"]   * n_easy +
        ["medium"] * n_medium +
        ["hard"]   * n_hard
    )

    while len(difficulties) < len(seeded):
        difficulties.append("medium")

    now = _now()
    for task, diff in zip(seeded, difficulties):
        existing_diff = task.get("difficulty") or diff
        db.table("tasks").update({
            "assigned_to": None,
            "difficulty":  existing_diff,
            "intern_role": intern_role,   # stamp the role so _pick_from_pool filters correctly
            "status":      "todo",
            "updated_at":  now,
        }).eq("id", task["id"]).execute()

    logger.info(
        f"[AdaptiveEngine] Pool reset done sprint={sprint_id}: "
        f"{n_easy} easy, {n_medium} medium, {n_hard} hard"
    )


def build_task_pool(
    project_id: str,
    group_id: str | None,
    sprint_id: str,
    intern_role: str,
    member_count: int,
) -> list[dict]:
    """
    Creates the unassigned task pool for a sprint.

    Pool size = ceil(member_count × 3.5), split ~43% easy / ~43% medium / ~14% hard.

    FIX (bug 2): Source 1 template search now handles NULL intern_role in seed data.
    Old code: .eq("intern_role", intern_role) — if seed tasks have intern_role=NULL,
    zero tasks found, pool stays empty, interns get no tasks.
    Fix: Two-pass search:
      Pass A — exact intern_role match (preferred)
      Pass B — intern_role IS NULL (seed data) — stamp with correct role on insert

    FIX (bug 6): "Already full" guard compares against total tasks in sprint
    (assigned + unassigned) rather than unassigned only.

    Sources (in order):
      1. Existing tasks already in the sprint (pool already built) — return unassigned.
      2. Template tasks: unassigned, sprint_id IS NULL, same project + role
         (with NULL-role fallback for seeded data)
      3. Legacy seeded tasks: already assigned to team members in this sprint
         → reset them to unassigned and stamp with difficulty
    """
    pool_size = math.ceil(member_count * 3.5)

    # Count ALL tasks in the sprint for this role (assigned + unassigned).
    # FIX (bug 8): Also fetch tasks with NULL intern_role — seeded data may not
    # have been stamped yet.  We stamp them below before the guard fires so that
    # _pick_from_pool can find them via the role filter on the next call.
    all_sprint_res = (
        db.table("tasks")
        .select("id, difficulty, assigned_to, status, intern_role")
        .eq("sprint_id", sprint_id)
        .eq("project_id", project_id)
        .execute()
    )
    all_sprint_raw = all_sprint_res.data or []

    # Stamp any un-roled tasks that belong to this sprint with the correct role
    now = _now()
    for row in all_sprint_raw:
        if not row.get("intern_role"):
            db.table("tasks").update({
                "intern_role": intern_role,
                "updated_at":  now,
            }).eq("id", row["id"]).execute()
            row["intern_role"] = intern_role
            logger.info(
                f"[AdaptiveEngine] build_task_pool: stamped NULL-role task "
                f"id={row['id']} sprint={sprint_id} as intern_role={intern_role}"
            )

    # Now filter to only this role's tasks
    all_sprint_tasks = [t for t in all_sprint_raw if t.get("intern_role") == intern_role]
    total_count = len(all_sprint_tasks)

    # Unassigned subset for callers
    existing = [t for t in all_sprint_tasks if t.get("assigned_to") is None]

    if total_count >= pool_size:
        logger.debug(
            f"[AdaptiveEngine] Pool already built sprint={sprint_id} role={intern_role} "
            f"(have {total_count} total, need {pool_size})"
        )
        return existing

    # How many of each difficulty already exist (assigned + unassigned)?
    existing_by_diff: dict[str, int] = {"easy": 0, "medium": 0, "hard": 0}
    for row in all_sprint_tasks:
        d = row.get("difficulty", "easy")
        if d in existing_by_diff:
            existing_by_diff[d] += 1

    n_easy, n_medium, n_hard = _pool_split(pool_size)
    need_easy   = max(0, n_easy   - existing_by_diff["easy"])
    need_medium = max(0, n_medium - existing_by_diff["medium"])
    need_hard   = max(0, n_hard   - existing_by_diff["hard"])
    still_needed = need_easy + need_medium + need_hard

    if still_needed == 0:
        return existing

    logger.info(
        f"[AdaptiveEngine] Building pool sprint={sprint_id} role={intern_role} "
        f"members={member_count} pool_size={pool_size} "
        f"(need e={need_easy} m={need_medium} h={need_hard})"
    )

    # ── Source 1: template tasks (sprint_id=NULL, assigned_to=NULL) ───────────
    # FIX (bug 2): Two-pass search — first with role match, then without role
    # (for seed data inserted without intern_role). Stamp role on all inserted rows.
    def _find_templates(role_filter) -> list[dict]:
        q = (
            db.table("tasks")
            .select("*")
            .eq("project_id", project_id)
            .is_("assigned_to", "null")
            .is_("sprint_id", "null")
        )
        if role_filter is not None:
            q = q.eq("intern_role", role_filter)
        else:
            q = q.is_("intern_role", "null")
        return q.execute().data or []

    # Pass A: exact role match
    templates = _find_templates(intern_role)

    # Pass B: NULL role fallback (seed data without role stamped)
    if not templates:
        templates = _find_templates(None)
        if templates:
            logger.info(
                f"[AdaptiveEngine] Found {len(templates)} template tasks with NULL "
                f"intern_role for project={project_id} — will stamp as role={intern_role}"
            )

    if templates:
        difficulties = (
            ["easy"]   * need_easy +
            ["medium"] * need_medium +
            ["hard"]   * need_hard
        )
        source   = list(itertools.islice(itertools.cycle(templates), still_needed))
        now      = _now()
        new_tasks = []
        for t, diff in zip(source, difficulties):
            new_tasks.append({
                "id":          str(uuid.uuid4()),
                "project_id":  project_id,
                "group_id":    group_id,
                "sprint_id":   sprint_id,
                "intern_role": intern_role,   # always stamp correct role
                "difficulty":  diff,
                "title":       t["title"],
                "description": t.get("description", ""),
                "priority":    t.get("priority", "medium"),
                "status":      "todo",
                "resources":   t.get("resources"),
                "task_doc":    t.get("task_doc"),
                "assigned_to": None,
                "created_at":  now,
                "updated_at":  now,
                "created_by":  None,
            })
        if new_tasks:
            db.table("tasks").insert(new_tasks).execute()
            logger.info(
                f"[AdaptiveEngine] Inserted {len(new_tasks)} pool tasks "
                f"from templates for sprint={sprint_id} role={intern_role}"
            )
        return existing + new_tasks

    # ── Source 2: legacy seeded tasks (already assigned to team members) ──────
    team_ids = _get_role_member_ids(project_id, group_id, intern_role)
    if team_ids:
        seeded_res = (
            db.table("tasks")
            .select("id, difficulty, title")
            .eq("sprint_id", sprint_id)
            .eq("project_id", project_id)
            .in_("assigned_to", team_ids)
            .execute()
        )
        seeded = seeded_res.data or []
        if seeded:
            _reset_seeded_tasks_to_pool(
                sprint_id=sprint_id,
                project_id=project_id,
                group_id=group_id,
                intern_role=intern_role,
                team_member_ids=team_ids,
            )
            refreshed = (
                db.table("tasks")
                .select("id, difficulty, assigned_to, status")
                .eq("sprint_id", sprint_id)
                .eq("project_id", project_id)
                .eq("intern_role", intern_role)
                .is_("assigned_to", "null")
                .execute()
            )
            return refreshed.data or []

    logger.warning(
        f"[AdaptiveEngine] No tasks found for sprint={sprint_id} "
        f"role={intern_role} project={project_id}. Pool empty."
    )
    return existing


# ── Initial assignment ─────────────────────────────────────────────────────────

def assign_initial_tasks(
    user_id: str,
    sprint_id: str,
    project_id: str,
    group_id: str | None,
    intern_role: str,
) -> None:
    """
    Assign exactly 1 easy + 1 medium task to an intern. Idempotent.

    FIX (bug 5): Hard guard — if intern already has ≥ 2 assigned tasks in
    this sprint, skip entirely.

    FIX (bug 1): intern_role passed to _pick_from_pool so tasks are filtered
    by role.

    FIX (bug 7): Always call build_task_pool before picking. If seeded tasks
    had intern_role=NULL, the pool was "built" (guard returned early) but no
    tasks matched the role filter in _pick_from_pool → intern got 0 tasks.
    build_task_pool is idempotent; calling it here guarantees pool tasks are
    stamped with the correct intern_role before we try to pick from them.
    """
    # FIX (bug 7): Ensure pool is built and tasks are role-stamped before picking.
    member_count = _count_role_members(project_id, group_id, intern_role)
    build_task_pool(
        project_id=project_id,
        group_id=group_id,
        sprint_id=sprint_id,
        intern_role=intern_role,
        member_count=member_count,
    )

    already_res = (
        db.table("tasks")
        .select("id, difficulty")
        .eq("sprint_id", sprint_id)
        .eq("assigned_to", user_id)
        .execute()
    )
    already_rows  = already_res.data or []
    already_count = len(already_rows)

    # Hard idempotency guard: intern already has their 2 starter tasks
    if already_count >= 2:
        logger.debug(
            f"[AdaptiveEngine] user={user_id} already has {already_count} tasks "
            f"in sprint={sprint_id} — skipping initial assignment"
        )
        return

    assigned_diffs = {row.get("difficulty") for row in already_rows}

    assigned = []
    for diff in ("easy", "medium"):
        if diff in assigned_diffs:
            logger.debug(
                f"[AdaptiveEngine] user={user_id} already has {diff} "
                f"task in sprint={sprint_id}"
            )
            continue
        task = _pick_from_pool(sprint_id, project_id, diff, intern_role)
        if task:
            _assign_task(task["id"], user_id, group_id)
            assigned.append(task)
        else:
            logger.warning(
                f"[AdaptiveEngine] No {diff} task in pool "
                f"sprint={sprint_id} for user={user_id} role={intern_role}"
            )

    if assigned:
        logger.info(
            f"[AdaptiveEngine] {len(assigned)} initial tasks assigned "
            f"→ user={user_id} sprint={sprint_id}: "
            + ", ".join(f"{t.get('difficulty')} '{t.get('title','')[:40]}'" for t in assigned)
        )


# ── Pool pick & assign ─────────────────────────────────────────────────────────

def _pick_from_pool(
    sprint_id: str,
    project_id: str,
    difficulty: str,
    intern_role: str,
) -> dict | None:
    """
    Pick the first unassigned task of the given difficulty from the sprint pool.

    FIX (bug 1): intern_role filter added. Old code picked any unassigned task
    in the sprint regardless of role.

    FIX (bug 7b): NULL-role fallback. Seeded tasks may have intern_role=NULL even
    after build_task_pool ran (pool-full guard may have fired before stamp loop).
    If no role-matched task found, pick a NULL-role task, stamp it, and return it.
    """
    # Primary: exact role match
    res = (
        db.table("tasks")
        .select("id, difficulty, title, intern_role")
        .eq("sprint_id", sprint_id)
        .eq("project_id", project_id)
        .eq("difficulty", difficulty)
        .eq("intern_role", intern_role)
        .is_("assigned_to", "null")
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]

    # Fallback: NULL intern_role — stamp it before returning
    null_res = (
        db.table("tasks")
        .select("id, difficulty, title, intern_role")
        .eq("sprint_id", sprint_id)
        .eq("project_id", project_id)
        .eq("difficulty", difficulty)
        .is_("intern_role", "null")
        .is_("assigned_to", "null")
        .limit(1)
        .execute()
    )
    if null_res.data:
        task = null_res.data[0]
        db.table("tasks").update({
            "intern_role": intern_role,
            "updated_at":  _now(),
        }).eq("id", task["id"]).execute()
        task["intern_role"] = intern_role
        logger.info(
            f"[AdaptiveEngine] _pick_from_pool: stamped NULL-role task "
            f"id={task['id']} as intern_role={intern_role}"
        )
        return task

    return None


def _assign_task(task_id: str, user_id: str, group_id: str | None) -> None:
    db.table("tasks").update({
        "assigned_to": user_id,
        "group_id":    group_id,
        "status":      "todo",
        "updated_at":  _now(),
    }).eq("id", task_id).execute()
    logger.info(f"[AdaptiveEngine] Assigned task={task_id} → user={user_id}")


def _has_pending_tasks(user_id: str, sprint_id: str) -> bool:
    """True if the intern has any non-done tasks assigned in this sprint."""
    res = (
        db.table("tasks")
        .select("id")
        .eq("assigned_to", user_id)
        .eq("sprint_id", sprint_id)
        .neq("status", "done")
        .execute()
    )
    return bool(res.data)


# ── Team sprint advance ────────────────────────────────────────────────────────

def _advance_sprint_for_team(
    current_sprint: dict,
    project_id: str,
    group_id: str | None,
    intern_role: str,
    member_count: int,
    triggered_by: str,
) -> dict | None:
    """
    Advance the entire team to the next sprint when ALL their assigned tasks are done.

    FIX (bug 3): Race condition — two members finishing simultaneously both pass
    _is_sprint_complete_for_team, both deactivate the sprint, both try to create
    the next sprint.
    Fix: After deactivating, re-check whether the next sprint already exists and
    is active (another thread beat us to it). If so, ensure this intern gets
    their initial tasks on the already-created sprint and return that sprint.

    Steps:
      1. Verify team sprint is complete (pre-deactivation check)
      2. Deactivate current sprint
      3. Check for already-active next sprint (race dedup)
      4. Get or create next sprint
      5. Build pool for next sprint
      6. Assign 1 easy + 1 medium to every team member
      7. Activate next sprint
      8. Notify all team members
    """
    current_number = _get_sprint_number(current_sprint.get("title", ""))
    if current_number is None:
        nums = re.findall(r"\d+", current_sprint.get("title", ""))
        current_number = int(nums[0]) if nums else 0
        logger.warning(
            f"[AdaptiveEngine] Could not parse sprint number from "
            f"'{current_sprint.get('title')}', assuming {current_number}"
        )

    if not _is_sprint_complete_for_team(
        current_sprint["id"], project_id, group_id, intern_role
    ):
        logger.info(
            f"[AdaptiveEngine] Sprint {current_sprint['id']} not complete "
            f"for team role={intern_role} group={group_id} — skipping advance"
        )
        return None

    next_number = current_number + 1
    logger.info(
        f"[AdaptiveEngine] Team advance role={intern_role} group={group_id}: "
        f"sprint {current_number} → {next_number} (triggered by user={triggered_by})"
    )

    # 1. Deactivate current sprint
    db.table("sprints").update({"is_active": False}).eq("id", current_sprint["id"]).execute()

    # ── FIX (bug 3): Race condition dedup ─────────────────────────────────────
    # Another thread may have already advanced and activated the next sprint.
    # Check before creating a duplicate.
    role_title       = intern_role.replace("_", " ").title()
    next_title       = f"Sprint {next_number} — {role_title}"
    existing_next_q  = (
        db.table("sprints")
        .select("*")
        .eq("project_id", project_id)
        .eq("title", next_title)
        .eq("is_active", True)
    )
    if group_id:
        existing_next_q = existing_next_q.eq("group_id", group_id)
    existing_next = existing_next_q.limit(1).execute()

    if existing_next.data:
        already_active_sprint = existing_next.data[0]
        logger.info(
            f"[AdaptiveEngine] Next sprint '{next_title}' already active "
            f"(race condition avoided) — ensuring tasks for user={triggered_by}"
        )
        # Ensure this late-arriving intern gets their initial tasks
        assign_initial_tasks(
            triggered_by,
            already_active_sprint["id"],
            project_id,
            group_id,
            intern_role,
        )
        return already_active_sprint
    # ── End race condition fix ─────────────────────────────────────────────────

    # 2. Get or create next sprint
    next_sprint = get_or_create_role_sprint(
        project_id=project_id,
        group_id=group_id,
        intern_role=intern_role,
        sprint_number=next_number,
        created_by=triggered_by,
    )

    # 3. Build pool
    build_task_pool(
        project_id=project_id,
        group_id=group_id,
        sprint_id=next_sprint["id"],
        intern_role=intern_role,
        member_count=member_count,
    )

    # 4. Assign initial tasks to every team member
    team_member_ids = _get_role_member_ids(project_id, group_id, intern_role)
    for member_id in team_member_ids:
        assign_initial_tasks(member_id, next_sprint["id"], project_id, group_id, intern_role)

    # 5. Activate new sprint
    db.table("sprints").update({"is_active": True}).eq("id", next_sprint["id"]).execute()

    # 6. Notify team
    for member_id in team_member_ids:
        upsert_notification(
            user_id=member_id,
            key=f"sprint_advance_{next_sprint['id']}_{member_id}",
            type_="sprint_advance",
            title=f"🚀 Sprint {next_number} Unlocked!",
            body=(
                f"Your team completed Sprint {current_number}. "
                f"Sprint {next_number} is now live — new tasks assigned!"
            ),
            icon="🚀",
            href="/dashboard",
            count=1,
        )

    return next_sprint


# ── Main entry point ───────────────────────────────────────────────────────────

def on_task_done(user_id: str, task_id: str) -> dict:
    """
    Called whenever an intern marks a task as 'done'.

    Flow:
      1. Resolve user's team context.
      2. Find which sprint the completed task belongs to.
      3. If intern still has non-done tasks → nothing to do.
      4. Compute performance score.
      5. Try to assign next pool task (tier-matched, then fallback tiers).
      6. If pool exhausted AND whole team done → advance team to next sprint.
      7. If pool exhausted but teammates still working → notify intern to wait.
    """
    ctx         = _get_user_context(user_id)
    project_id  = ctx["project_id"]
    group_id    = ctx["group_id"]
    intern_role = ctx["intern_role"]

    if not project_id:
        return {"action": "none", "reason": "no active project"}

    task_res = (
        db.table("tasks")
        .select("sprint_id")
        .eq("id", task_id)
        .limit(1)
        .execute()
    )
    if not task_res.data:
        return {"action": "none", "reason": "task not found"}

    sprint_id = task_res.data[0].get("sprint_id")
    if not sprint_id:
        return {"action": "none", "reason": "task has no sprint_id"}

    # Step 1 — intern still has active tasks?
    if _has_pending_tasks(user_id, sprint_id):
        return {"action": "none", "reason": "intern still has active tasks"}

    # Step 2 — compute performance score
    perf  = compute_performance_score(user_id, sprint_id)
    tier  = perf["difficulty_tier"]
    score = perf["performance_score"]

    logger.info(
        f"[AdaptiveEngine] on_task_done user={user_id} sprint={sprint_id} "
        f"score={score:.1f} tier={tier}"
    )

    # Step 3 — try to assign next pool task (preferred tier, then fallbacks)
    # FIX (bug 1): pass intern_role to _pick_from_pool
    tier_order = {
        "easy":   ["easy", "medium", "hard"],
        "medium": ["medium", "easy", "hard"],
        "hard":   ["hard", "medium", "easy"],
    }
    for try_tier in tier_order.get(tier, [tier]):
        pool_task = _pick_from_pool(sprint_id, project_id, try_tier, intern_role or "")
        if pool_task:
            _assign_task(pool_task["id"], user_id, group_id)
            upsert_notification(
                user_id=user_id,
                key=f"new_task_{pool_task['id']}",
                type_="new_task",
                title="📋 New Task Assigned",
                body=(
                    f"Score {score:.0f} → assigned {try_tier} task: "
                    f"\"{pool_task['title']}\""
                ),
                icon="📋",
                href="/dashboard",
                count=1,
            )
            return {
                "action":     "assigned",
                "task_id":    pool_task["id"],
                "task_title": pool_task["title"],
                "difficulty": try_tier,
                "score":      score,
            }

    # Pool exhausted — fetch sprint record
    sprint_res = (
        db.table("sprints")
        .select("*")
        .eq("id", sprint_id)
        .limit(1)
        .execute()
    )
    if not sprint_res.data:
        return {"action": "none", "reason": "sprint record not found"}

    current_sprint = sprint_res.data[0]

    # Check if the whole team is done
    if not _is_sprint_complete_for_team(sprint_id, project_id, group_id, intern_role or ""):
        upsert_notification(
            user_id=user_id,
            key=f"sprint_waiting_{sprint_id}_{user_id}",
            type_="sprint_waiting",
            title="⏳ Waiting for Teammates",
            body=(
                "You've finished all your tasks! "
                "Waiting for your teammates to complete the sprint."
            ),
            icon="⏳",
            href="/dashboard",
            count=1,
        )
        return {
            "action": "waiting",
            "reason": "pool exhausted; waiting for team sprint completion",
            "score":  score,
        }

    # Whole team done → advance
    member_count = _count_role_members(project_id, group_id, intern_role or "")
    next_sprint  = _advance_sprint_for_team(
        current_sprint=current_sprint,
        project_id=project_id,
        group_id=group_id,
        intern_role=intern_role or "",
        member_count=member_count,
        triggered_by=user_id,
    )

    if next_sprint:
        return {
            "action":           "sprint_advanced",
            "new_sprint_id":    next_sprint["id"],
            "new_sprint_title": next_sprint["title"],
            "score":            score,
        }

    return {"action": "none", "reason": "pool exhausted and could not advance sprint"}


# ── Sprint initialisation (called from projects.py on join) ───────────────────

def initialise_sprint_for_intern(
    user_id: str,
    project_id: str,
    group_id: str | None,
    intern_role: str,
) -> dict | None:
    """
    Called when an intern joins a project.

    Steps:
      1. Count team members.
      2. Find or create Sprint 0 (role-scoped — will NOT adopt another role's sprint).
      3. Build task pool (idempotent — guards against double-insertion).
      4. Assign 2 initial tasks (1 easy + 1 medium) to this intern (idempotent).
      5. Ensure sprint is marked active.

    Safe to call multiple times — all operations are idempotent.
    """
    member_count = _count_role_members(project_id, group_id, intern_role)

    sprint = get_or_create_role_sprint(
        project_id=project_id,
        group_id=group_id,
        intern_role=intern_role,
        sprint_number=0,
        created_by=user_id,
    )

    build_task_pool(
        project_id=project_id,
        group_id=group_id,
        sprint_id=sprint["id"],
        intern_role=intern_role,
        member_count=member_count,
    )

    # FIX (bug 1): pass intern_role to assign_initial_tasks
    assign_initial_tasks(user_id, sprint["id"], project_id, group_id, intern_role)

    # Ensure the sprint is active
    if not sprint.get("is_active"):
        db.table("sprints").update({"is_active": True}).eq("id", sprint["id"]).execute()
        sprint["is_active"] = True

    logger.info(
        f"[AdaptiveEngine] Sprint initialised sprint={sprint['id']} "
        f"'{sprint['title']}' user={user_id} role={intern_role} members={member_count}"
    )
    return sprint


# ── Recovery: fix interns with tasks but no active sprint ─────────────────────

def recover_intern_sprint(
    user_id: str,
    project_id: str,
    group_id: str | None,
    intern_role: str,
) -> dict:
    """
    Diagnose and fix an intern stuck in one of these broken states:

      State A — No sprint at all (initialise_sprint_for_intern was never called)
        Fix: call initialise_sprint_for_intern

      State B — Sprint exists but is_active=False (sprint got created but not activated)
        Fix: activate the sprint, rebuild pool if empty, assign initial tasks

      State C — Sprint is active but intern has 0 tasks assigned
        Fix: rebuild pool if empty, assign initial tasks

      State D — Tasks exist with sprint_id=NULL (template tasks never linked)
        This is handled by build_task_pool Source 1 NULL-role fallback.
        Fix: call initialise_sprint_for_intern which triggers build_task_pool

    Returns a dict describing what was detected and what action was taken.
    """
    logger.info(
        f"[AdaptiveEngine] Recovery check user={user_id} "
        f"project={project_id} group={group_id} role={intern_role}"
    )

    # ── Check 1: Does the intern have an active sprint? ────────────────────────
    role_title   = intern_role.replace("_", " ").title()
    sprint_title_pattern = f"Sprint 0 — {role_title}"

    active_q = (
        db.table("sprints")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_active", True)
    )
    if group_id:
        active_q = active_q.eq("group_id", group_id)
    active_sprints = active_q.execute().data or []

    role_needle   = intern_role.replace("_", " ").lower()
    active_sprint = next(
        (s for s in active_sprints if role_needle in (s.get("title") or "").lower()),
        None,
    )

    # ── Check 2: Does the intern have any existing tasks with this sprint? ─────
    if active_sprint:
        tasks_res = (
            db.table("tasks")
            .select("id")
            .eq("sprint_id", active_sprint["id"])
            .eq("assigned_to", user_id)
            .execute()
        )
        if tasks_res.data:
            return {
                "status": "healthy",
                "sprint_id": active_sprint["id"],
                "sprint_title": active_sprint["title"],
                "tasks_assigned": len(tasks_res.data),
                "action_taken": "none",
            }

        # State C: active sprint but intern has no tasks
        logger.info(
            f"[AdaptiveEngine] Recovery State C: active sprint but 0 tasks "
            f"for user={user_id} sprint={active_sprint['id']}"
        )
        member_count = _count_role_members(project_id, group_id, intern_role)
        build_task_pool(
            project_id=project_id,
            group_id=group_id,
            sprint_id=active_sprint["id"],
            intern_role=intern_role,
            member_count=member_count,
        )
        assign_initial_tasks(
            user_id, active_sprint["id"], project_id, group_id, intern_role
        )
        return {
            "status": "recovered",
            "sprint_id": active_sprint["id"],
            "sprint_title": active_sprint["title"],
            "action_taken": "assigned_initial_tasks_to_existing_sprint",
        }

    # ── Check 3: Does an inactive sprint exist? ────────────────────────────────
    inactive_q = (
        db.table("sprints")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_active", False)
    )
    if group_id:
        inactive_q = inactive_q.eq("group_id", group_id)
    inactive_sprints = inactive_q.execute().data or []

    inactive_sprint = next(
        (s for s in inactive_sprints if role_needle in (s.get("title") or "").lower()),
        None,
    )

    if inactive_sprint:
        # State B: sprint exists but not active
        logger.info(
            f"[AdaptiveEngine] Recovery State B: inactive sprint found "
            f"for user={user_id} sprint={inactive_sprint['id']} — activating"
        )
        db.table("sprints").update({"is_active": True}).eq("id", inactive_sprint["id"]).execute()
        member_count = _count_role_members(project_id, group_id, intern_role)
        build_task_pool(
            project_id=project_id,
            group_id=group_id,
            sprint_id=inactive_sprint["id"],
            intern_role=intern_role,
            member_count=member_count,
        )
        assign_initial_tasks(
            user_id, inactive_sprint["id"], project_id, group_id, intern_role
        )
        return {
            "status": "recovered",
            "sprint_id": inactive_sprint["id"],
            "sprint_title": inactive_sprint["title"],
            "action_taken": "activated_sprint_and_assigned_tasks",
        }

    # State A: no sprint at all — full initialise
    logger.info(
        f"[AdaptiveEngine] Recovery State A: no sprint found at all — "
        f"running full initialise for user={user_id} role={intern_role}"
    )
    sprint = initialise_sprint_for_intern(
        user_id=user_id,
        project_id=project_id,
        group_id=group_id,
        intern_role=intern_role,
    )
    if not sprint:
        return {
            "status": "failed",
            "action_taken": "initialise_sprint_for_intern_returned_none",
        }
    return {
        "status": "recovered",
        "sprint_id": sprint["id"],
        "sprint_title": sprint["title"],
        "action_taken": "full_sprint_initialisation",
    }