"""
notifications.py
────────────────
Notifications backed by a dedicated `notifications` table.

Table schema (run once in Supabase SQL editor):
────────────────────────────────────────────────
create table notifications (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    key         text not null,
    type        text not null,
    title       text not null,
    body        text not null default '',
    icon        text not null default '🔔',
    href        text not null default '/dashboard',
    count       int  not null default 1,
    is_read     bool not null default false,
    created_at  timestamptz not null default now()
);
create index on notifications(user_id, is_read, created_at desc);
────────────────────────────────────────────────

How it works:
  - upsert_notification() is called from wherever the event occurs:
      chat handler   → key='chat',     icon='💬'
      task handler   → key='calendar', icon='📅'
      ticket handler → key='tickets',  icon='🎫'
  - It finds the existing UNREAD row for (user_id, key) and updates it
    (refreshing title, body, count, created_at), or inserts a new one.
  - GET  /api/notifications   → returns all is_read=false rows, newest first
  - POST /api/notifications/mark-read → flips is_read=true on given ids (or all)

No timestamp arithmetic, no localStorage dismissed state, no cutoff juggling.

ROOT CAUSE FIX:
  upsert_notification() writes rows using supabase_admin (service role),
  which bypasses RLS. But GET /api/notifications was reading with the regular
  `db` client (anon/user-scoped). If your RLS policy is:
      USING (auth.uid() = user_id)
  then rows inserted by the service role are invisible to the user-scoped
  client because no auth session owns them.

  Fix: use supabase_admin for ALL notifications DB operations, and always
  filter explicitly by user_id in code so security is enforced application-side.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.core.auth import get_current_user
from app.core.database import supabase_admin          # ← use admin for all ops
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def upsert_notification(
    *,
    user_id: str,
    key: str,
    type_: str,
    title: str,
    body: str,
    icon: str,
    href: str,
    count: int = 1,
) -> None:
    """
    Create or refresh the unread notification for (user_id, key).

    Always uses supabase_admin so the write succeeds regardless of RLS policies.
    The GET endpoint also uses supabase_admin and filters by user_id in code.
    """
    try:
        logger.info(f"upsert_notification called key={key} user={user_id} title={title}")
        existing = (
            supabase_admin.table("notifications")
            .select("id")
            .eq("user_id", user_id)
            .eq("key", key)
            .eq("is_read", False)
            .limit(1)
            .execute()
        )
        logger.info(f"upsert_notification existing={existing.data}")
        payload = {
            "key":        key,
            "type":       type_,
            "title":      title,
            "body":       body,
            "icon":       icon,
            "href":       href,
            "count":      count,
            "is_read":    False,
            "created_at": _now_iso(),
        }
        if existing.data:
            res = (
                supabase_admin.table("notifications")
                .update(payload)
                .eq("id", existing.data[0]["id"])
                .execute()
            )
            logger.info(f"upsert_notification updated id={existing.data[0]['id']} res={res.data}")
        else:
            res = (
                supabase_admin.table("notifications")
                .insert({**payload, "user_id": user_id})
                .execute()
            )
            logger.info(f"upsert_notification inserted res={res.data}")

    except Exception as e:
        logger.error(f"upsert_notification FAILED key={key} user={user_id}: {e}", exc_info=True)


# ─── Pydantic ─────────────────────────────────────────────────────────────────

class MarkReadBody(BaseModel):
    ids: Optional[list[str]] = None   # notification UUIDs; omit to mark ALL unread


class PushBody(BaseModel):
    """Body for the /push endpoint — user_id is ignored, auth token is used instead."""
    user_id: Optional[str] = None
    key:     str
    type_:   str = "chat"
    title:   str
    body:    str = ""
    icon:    str = "🔔"
    href:    str = "/dashboard"
    count:   int = 1


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    """
    Return all unread notification rows for the current user, newest first.

    FIX: uses supabase_admin instead of the user-scoped `db` client.
    Rows written by upsert_notification (also via supabase_admin / service role)
    are invisible to the user-scoped client when RLS is enabled with
    `USING (auth.uid() = user_id)`, because service-role inserts are not
    associated with any auth session. Using supabase_admin here + explicit
    user_id filter enforces security at the application layer instead.
    """
    user_id = current_user["id"]
    try:
        res = (
    supabase_admin.table("notifications")   # ← change db to supabase_admin
    .select("id, key, type, title, body, icon, href, count, created_at")
    .eq("user_id", user_id)
    .eq("is_read", False)
    .order("created_at", desc=True)
    .execute()
)

        return res.data or []
    except Exception as e:
        logger.error(f"get_notifications failed user={user_id}: {e}")
        return []


@router.post("/mark-read")
async def mark_read(
    body: MarkReadBody,
    current_user: dict = Depends(get_current_user),
):
    """
    Mark notifications as read.
    - Pass ids=[...] to mark specific notifications.
    - Omit ids (or pass null) to mark ALL unread notifications for this user.
    """
    user_id = current_user["id"]
    try:
        q = (
    supabase_admin.table("notifications")   # ← change db to supabase_admin
    .update({"is_read": True})
    .eq("user_id", user_id)
    .eq("is_read", False)
)
        if body.ids:
            q = q.in_("id", body.ids)
        q.execute()
        return {"ok": True}
    except Exception as e:
        logger.error(f"mark_read failed user={user_id}: {e}")
        return {"ok": False, "error": str(e)}


@router.post("/push")
async def push_notification(
    body: PushBody,
    current_user: dict = Depends(get_current_user),
):
    """
    Create or refresh an unread notification for the currently authenticated user.
    Intended for frontend-triggered events (e.g. adding a calendar event).
    """
    upsert_notification(
        user_id=current_user["id"],   # always use the auth token, never trust body
        key=body.key,
        type_=body.type_,
        title=body.title,
        body=body.body,
        icon=body.icon,
        href=body.href,
        count=body.count,
    )
    return {"ok": True}