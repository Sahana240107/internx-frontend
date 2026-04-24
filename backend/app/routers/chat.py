from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from pydantic import BaseModel
from app.core.auth import get_current_user
from app.core.database import db, supabase_admin
from app.routers.notifications import upsert_notification
import uuid, mimetypes, json, logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

FILE_BUCKET = "chat-attachments"


class SendMessageRequest(BaseModel):
    project_id: str
    content: str
    message_type: str = "text"


class SaveWhiteboardRequest(BaseModel):
    project_id: str
    data_url: str


def _notify_project_members(sender_id: str, project_id: str, sender_name: str, preview: str, count: int = 1):
    """Upsert a chat notification for every project member except the sender."""
    try:
        members = (
            db.table("profiles")
            .select("id")
            .eq("project_id", project_id)
            .neq("id", sender_id)
            .execute()
        )
        for m in (members.data or []):
            # Count unread messages for this recipient so the badge is accurate
            try:
                last_seen_res = (
                    db.table("notifications")
                    .select("count")
                    .eq("user_id", m["id"])
                    .eq("key", "chat")
                    .eq("is_read", False)
                    .limit(1)
                    .execute()
                )
                existing_count = int((last_seen_res.data or [{}])[0].get("count", 0)) if last_seen_res.data else 0
                total = existing_count + 1
            except Exception:
                total = count

            upsert_notification(
                user_id=m["id"],
                key="chat",
                type_="chat",
                title=f"{total} new message{'s' if total > 1 else ''} in project chat",
                body=f"{sender_name}: {preview}",
                icon="💬",
                href="/dashboard/chat",
                count=total,
            )
    except Exception as e:
        logger.warning(f"_notify_project_members failed: {e}")


def _assert_member(user_id: str, project_id: str):
    # Check direct profile membership (single-player / legacy)
    row = (
        db.table("profiles")
        .select("id")
        .eq("id", user_id)
        .eq("project_id", project_id)
        .limit(1)
        .execute()
    )
    if row.data:
        return  # ✅ direct member

    # Check multiplayer membership via project_groups → group_members
    groups_res = (
        db.table("project_groups")
        .select("id")
        .eq("project_id", project_id)
        .execute()
    )
    group_ids = [g["id"] for g in (groups_res.data or [])]
    if group_ids:
        gm_row = (
            db.table("group_members")
            .select("user_id")
            .eq("user_id", user_id)
            .in_("group_id", group_ids)
            .limit(1)
            .execute()
        )
        if gm_row.data:
            return  # ✅ group member

    raise HTTPException(403, "Not a member of this project")


@router.get("/messages/{project_id}")
async def get_messages(
    project_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    _assert_member(current_user["id"], project_id)
    rows = (
        db.table("project_messages")
        .select("*, profiles(id, name, avatar_url, intern_role)")
        .eq("project_id", project_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return rows.data or []


@router.post("/messages")
async def send_message(
    body: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    _assert_member(current_user["id"], body.project_id)

    allowed_types = {"text", "whiteboard", "emoji", "file"}
    if body.message_type not in allowed_types:
        raise HTTPException(400, f"Invalid message_type. Allowed: {allowed_types}")

    row = {
        "id":           str(uuid.uuid4()),
        "project_id":   body.project_id,
        "sender_id":    current_user["id"],
        "content":      body.content,
        "message_type": body.message_type,
    }
    result = db.table("project_messages").insert(row).execute()
    if not result.data:
        raise HTTPException(500, "Failed to save message")

    saved = result.data[0]
    sender_name = current_user.get("name") or current_user.get("email", "A teammate")
    preview = body.content[:80] + ("…" if len(body.content) > 80 else "")
    _notify_project_members(current_user["id"], body.project_id, sender_name, preview)

    return saved


@router.post("/upload")
async def upload_file(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    logger.info(f"[UPLOAD] Started — user={current_user['id']} project={project_id} file={file.filename} content_type={file.content_type}")

    # ── 1. Auth check ──────────────────────────────────────────────────────
    try:
        _assert_member(current_user["id"], project_id)
        logger.info("[UPLOAD] Member check passed")
    except HTTPException as e:
        logger.error(f"[UPLOAD] Member check FAILED: {e.detail}")
        raise

    # ── 2. Read file ───────────────────────────────────────────────────────
    MAX_SIZE = 20 * 1024 * 1024
    contents = await file.read()
    logger.info(f"[UPLOAD] File read — size={len(contents)} bytes")
    if len(contents) == 0:
        raise HTTPException(400, "Uploaded file is empty")
    if len(contents) > MAX_SIZE:
        raise HTTPException(413, "File too large (max 20 MB)")

    # ── 3. Determine MIME ──────────────────────────────────────────────────
    mime = (
        file.content_type
        or mimetypes.guess_type(file.filename or "")[0]
        or "application/octet-stream"
    )
    safe_name = (file.filename or "upload").replace(" ", "_")
    key = f"{project_id}/{uuid.uuid4()}-{safe_name}"
    logger.info(f"[UPLOAD] Storage key={key}  mime={mime}")

    # ── 4. Upload to Supabase Storage ──────────────────────────────────────
    try:
        upload_res = supabase_admin.storage.from_(FILE_BUCKET).upload(
            key, contents, {"content-type": mime, "x-upsert": "false"}
        )
        logger.info(f"[UPLOAD] Storage upload_res type={type(upload_res)}  value={upload_res}")
    except Exception as exc:
        logger.error(f"[UPLOAD] Storage upload EXCEPTION: {exc}", exc_info=True)
        raise HTTPException(500, f"Storage upload exception: {exc}")

    if hasattr(upload_res, "error") and upload_res.error:
        logger.error(f"[UPLOAD] Storage upload error attr: {upload_res.error}")
        raise HTTPException(500, f"Storage upload failed: {upload_res.error}")

    # ── 5. Get public URL ──────────────────────────────────────────────────
    try:
        raw_url = supabase_admin.storage.from_(FILE_BUCKET).get_public_url(key)
        logger.info(f"[UPLOAD] raw_url type={type(raw_url)}  value={raw_url}")
    except Exception as exc:
        logger.error(f"[UPLOAD] get_public_url EXCEPTION: {exc}", exc_info=True)
        raise HTTPException(500, f"get_public_url exception: {exc}")

    if isinstance(raw_url, dict):
        public_url = raw_url.get("publicUrl") or raw_url.get("publicURL") or ""
    else:
        public_url = str(raw_url)

    logger.info(f"[UPLOAD] public_url={public_url}")
    if not public_url:
        raise HTTPException(500, "Could not resolve public URL from storage")

    # ── 6. Save message to DB ──────────────────────────────────────────────
    meta = json.dumps({
        "name": file.filename,
        "size": len(contents),
        "mime": mime,
        "url":  public_url,
    })

    row = {
        "id":           str(uuid.uuid4()),
        "project_id":   project_id,
        "sender_id":    current_user["id"],
        "content":      meta,
        "message_type": "file",
    }
    logger.info(f"[UPLOAD] Inserting DB row: {row}")

    try:
        result = db.table("project_messages").insert(row).execute()
        logger.info(f"[UPLOAD] DB insert result: data={result.data}")
    except Exception as exc:
        logger.error(f"[UPLOAD] DB insert EXCEPTION: {exc}", exc_info=True)
        raise HTTPException(500, f"DB insert exception: {exc}")

    if not result.data:
        logger.error(f"[UPLOAD] DB insert returned no data. Full result: {result}")
        raise HTTPException(500, "File uploaded to storage but DB insert returned nothing — check message_type constraint")

    saved = result.data[0]
    logger.info(f"[UPLOAD] Success — saved message id={saved.get('id')}")

    sender_name = current_user.get("name") or current_user.get("email", "A teammate")
    _notify_project_members(current_user["id"], project_id, sender_name, f"sent a file: {file.filename}")

    return {**saved, "public_url": public_url}


@router.post("/whiteboard/save")
async def save_whiteboard(
    body: SaveWhiteboardRequest,
    current_user: dict = Depends(get_current_user),
):
    _assert_member(current_user["id"], body.project_id)
    row = {
        "id":           str(uuid.uuid4()),
        "project_id":   body.project_id,
        "sender_id":    current_user["id"],
        "content":      body.data_url,
        "message_type": "whiteboard",
    }
    result = db.table("project_messages").insert(row).execute()
    if not result.data:
        raise HTTPException(500, "Failed to save whiteboard")
    return result.data[0]


@router.get("/meet/{project_id}")
async def get_meet_link(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    _assert_member(current_user["id"], project_id)
    result = db.table("projects").select("meet_url").eq("id", project_id).single().execute()
    meet_url = (result.data or {}).get("meet_url") or "https://meet.google.com/"
    return {"meet_url": meet_url}
