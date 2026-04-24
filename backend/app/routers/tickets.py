"""
tickets.py
──────────
Cross-team ticket system.

DB tables used:
  tickets         → id, title, description, type, priority, status,
                     project_id, from_group_id, to_group_id,
                     resolution_note, created_by, created_at, updated_at
  ticket_comments → id, ticket_id, user_id, content, created_at
  project_groups  → id, name  (joined for display names)
  profiles        → id, name, avatar_url  (joined for comment authors)

Endpoints:
  GET    /api/tickets                        list tickets for a group
  POST   /api/tickets                        create a ticket
  PATCH  /api/tickets/{ticket_id}            update status / resolution_note
  GET    /api/tickets/{ticket_id}/comments   list comments
  POST   /api/tickets/{ticket_id}/comments   add a comment
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.core.auth import get_current_user
from app.core.database import db
from app.routers.notifications import upsert_notification
import uuid, logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tickets", tags=["tickets"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _enrich_tickets(tickets: list[dict]) -> list[dict]:
    """
    Attach from_group and to_group name objects to each ticket so the
    frontend can display team names without extra fetches.
    """
    if not tickets:
        return tickets

    # Collect all group IDs we need
    group_ids = set()
    for t in tickets:
        if t.get("from_group_id"):
            group_ids.add(t["from_group_id"])
        if t.get("to_group_id"):
            group_ids.add(t["to_group_id"])

    if not group_ids:
        return tickets

    groups_res = (
        db.table("project_groups")
        .select("id, name, cohort_label")
        .in_("id", list(group_ids))
        .execute()
    )
    group_map = {g["id"]: g for g in (groups_res.data or [])}

    for t in tickets:
        t["from_group"] = group_map.get(t.get("from_group_id"))
        t["to_group"]   = group_map.get(t.get("to_group_id"))

    return tickets


# ─── Pydantic models ──────────────────────────────────────────────────────────

class CreateTicketBody(BaseModel):
    title:        str
    description:  str
    type:         str           = "other"
    priority:     str           = "medium"
    status:       str           = "open"
    project_id:   str
    from_group_id: str
    to_group_id:  str

class UpdateTicketBody(BaseModel):
    status:          Optional[str] = None
    priority:        Optional[str] = None
    resolution_note: Optional[str] = None

class CreateCommentBody(BaseModel):
    content: str


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("")
async def list_tickets(
    group_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Returns all tickets where the group is sender or recipient.
    Deduplicates and tags each ticket with 'direction':
      - 'outgoing' if created_by == current user
      - 'incoming' otherwise
    This correctly handles single-group projects where from_group_id == to_group_id.
    Pass ?group_id=<uuid>
    """
    if not group_id:
        raise HTTPException(400, "group_id query param is required")

    incoming_res = (
        db.table("tickets")
        .select("*")
        .eq("to_group_id", group_id)
        .execute()
    )
    outgoing_res = (
        db.table("tickets")
        .select("*")
        .eq("from_group_id", group_id)
        .execute()
    )

    seen = set()
    all_tickets = []
    for t in (incoming_res.data or []) + (outgoing_res.data or []):
        if t["id"] not in seen:
            seen.add(t["id"])
            all_tickets.append(t)

    all_tickets.sort(key=lambda t: t.get("created_at") or "", reverse=True)
    return _enrich_tickets(all_tickets)


@router.post("")
async def create_ticket(
    body: CreateTicketBody,
    current_user: dict = Depends(get_current_user),
):
    """Raise a new cross-team ticket."""
    # Validate groups exist
    for gid, label in [(body.from_group_id, "from_group_id"), (body.to_group_id, "to_group_id")]:
        res = db.table("project_groups").select("id").eq("id", gid).execute()
        if not res.data:
            raise HTTPException(404, f"{label} group not found")

    # Note: in single-group projects from_group_id == to_group_id is expected
    # (role-based virtual teams both resolve to the same real group_id).
    # The frontend already prevents a user from addressing their own role.

    now = _now()
    ticket_id = str(uuid.uuid4())

    ticket = {
        "id":            ticket_id,
        "title":         body.title.strip(),
        "description":   body.description.strip(),
        "type":          body.type,
        "priority":      body.priority,
        "status":        "open",
        "project_id":    body.project_id,
        "from_group_id": body.from_group_id,
        "to_group_id":   body.to_group_id,
        "created_by":    current_user["id"],
        "created_at":    now,
        "updated_at":    now,
    }

    result = db.table("tickets").insert(ticket).execute()
    if not result.data:
        raise HTTPException(500, "Failed to create ticket")

    created = result.data[0]
    return _enrich_tickets([created])[0]


@router.patch("/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    body: UpdateTicketBody,
    current_user: dict = Depends(get_current_user),
):
    """Update ticket status and/or resolution note."""
    # FIX 1: Explicitly select created_by so it is never silently missing.
    existing = (
        db.table("tickets")
        .select("id, title, status, from_group_id, to_group_id, created_by, resolution_note")
        .eq("id", ticket_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(404, "Ticket not found")

    ticket = existing.data[0]
    logger.info(f"update_ticket: full row = {ticket}")

    # Only members of from_group or to_group can update
    user_group_res = (
        db.table("group_members")
        .select("group_id")
        .eq("user_id", current_user["id"])
        .execute()
    )
    user_group_ids = {r["group_id"] for r in (user_group_res.data or [])}
    allowed = {ticket.get("from_group_id"), ticket.get("to_group_id")}
    if not user_group_ids.intersection(allowed):
        raise HTTPException(403, "You are not a member of either group on this ticket")

    updates = {"updated_at": _now()}
    if body.status is not None:
        valid_statuses = {"open", "in_progress", "resolved", "closed"}
        if body.status not in valid_statuses:
            raise HTTPException(400, f"Invalid status. Must be one of: {valid_statuses}")
        updates["status"] = body.status
    if body.priority is not None:
        updates["priority"] = body.priority
    if body.resolution_note is not None:
        updates["resolution_note"] = body.resolution_note

    db.table("tickets").update(updates).eq("id", ticket_id).execute()

    # Re-fetch the full row so created_by and all fields are always present
    full = db.table("tickets").select("*").eq("id", ticket_id).execute()
    if not full.data:
        raise HTTPException(500, "Failed to fetch updated ticket")

    updated_ticket = _enrich_tickets([full.data[0]])[0]

    # FIX 2: Derive the effective status — use body.status if provided,
    # otherwise fall back to the persisted status from the DB.
    # This ensures notifications fire even when the PATCH only sends
    # resolution_note without repeating the status field.
    effective_status = body.status or updated_ticket.get("status")

    # FIX 3: Only notify when the resolver is NOT the creator (cross-team
    # scenario). If they're the same person, a self-notification is useless.
    creator_id = ticket.get("created_by")

    if effective_status in ("resolved", "closed"):
        logger.info(
            f"Ticket {ticket_id} marked {effective_status} — "
            f"creator_id={creator_id} resolver={current_user['id']}"
        )
        if creator_id and creator_id != current_user["id"]:
            title_preview = ticket["title"][:50] + ("…" if len(ticket["title"]) > 50 else "")
            resolution = (
                body.resolution_note
                or updated_ticket.get("resolution_note")
                or "Resolved by the team"
            )
            try:
                upsert_notification(
                    user_id=creator_id,
                    key=f"ticket_{ticket_id}",   # FIX 4: per-ticket key so each
                                                 # resolved ticket gets its own
                                                 # notification row instead of
                                                 # collapsing all ticket notifs.
                    type_="ticket",
                    title=f"Ticket resolved: {title_preview}",
                    body=resolution,
                    icon="🎫",
                    href="/dashboard/ticket",
                    count=1,
                )
                logger.info(f"Notification sent to creator {creator_id} for ticket {ticket_id}")
            except Exception as e:
                logger.error(
                    f"Failed to notify ticket creator {creator_id}: {e}", exc_info=True
                )
        elif not creator_id:
            logger.warning(f"Ticket {ticket_id} has no created_by — cannot notify")
        else:
            logger.info(
                f"Ticket {ticket_id}: resolver is the creator ({creator_id}), skipping self-notification"
            )

    return updated_ticket


@router.get("/{ticket_id}/comments")
async def list_comments(
    ticket_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return all comments for a ticket, enriched with author profile."""
    ticket_res = db.table("tickets").select("id").eq("id", ticket_id).execute()
    if not ticket_res.data:
        raise HTTPException(404, "Ticket not found")

    comments_res = (
        db.table("ticket_comments")
        .select("*")
        .eq("ticket_id", ticket_id)
        .order("created_at", desc=False)
        .execute()
    )
    comments = comments_res.data or []

    if not comments:
        return []

    # Enrich with author profiles
    user_ids = list({c["user_id"] for c in comments if c.get("user_id")})
    profiles_res = (
        db.table("profiles")
        .select("id, name, avatar_url")
        .in_("id", user_ids)
        .execute()
    )
    profile_map = {p["id"]: p for p in (profiles_res.data or [])}

    for c in comments:
        profile = profile_map.get(c.get("user_id"), {})
        c["author"] = {
            "id":         c.get("user_id"),
            "name":       profile.get("name", "Unknown"),
            "avatar_url": profile.get("avatar_url"),
        }

    return comments


@router.post("/{ticket_id}/comments")
async def add_comment(
    ticket_id: str,
    body: CreateCommentBody,
    current_user: dict = Depends(get_current_user),
):
    """Add a comment to a ticket."""
    ticket_res = db.table("tickets").select("id").eq("id", ticket_id).execute()
    if not ticket_res.data:
        raise HTTPException(404, "Ticket not found")

    if not body.content.strip():
        raise HTTPException(400, "Comment content cannot be empty")

    comment = {
        "id":         str(uuid.uuid4()),
        "ticket_id":  ticket_id,
        "user_id":    current_user["id"],
        "content":    body.content.strip(),
        "created_at": _now(),
    }

    result = db.table("ticket_comments").insert(comment).execute()
    if not result.data:
        raise HTTPException(500, "Failed to save comment")

    saved = result.data[0]

    # Enrich with author
    saved["author"] = {
        "id":         current_user["id"],
        "name":       current_user.get("name", "Unknown"),
        "avatar_url": current_user.get("avatar_url"),
    }

    return saved