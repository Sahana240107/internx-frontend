# backend/app/services/mentor_chat.py
from groq import Groq
from app.core.config import get_settings
from app.core.database import get_supabase
from app.services.prompts import build_system_prompt
from typing import AsyncGenerator

settings = get_settings()
client = Groq(api_key=settings.groq_api_key)
MODEL = "llama-3.3-70b-versatile"


def _get_task(task_id: str) -> dict:
    supabase = get_supabase()
    result = supabase.table("tasks").select("*").eq("id", task_id).single().execute()
    if not result.data:
        raise ValueError(f"Task {task_id} not found")

    assigned_to = result.data.get("assigned_to")
    role = "default"
    if assigned_to:
        profile = supabase.table("profiles").select("role, intern_role").eq("id", assigned_to).single().execute()
        if profile.data:
            role = profile.data.get("intern_role") or profile.data.get("role") or "default"

    result.data["_role"] = role
    return result.data


def _get_or_create_session(task_id: str, user_id: str) -> str:
    supabase = get_supabase()
    result = (
        supabase.table("mentor_sessions")
        .select("id")
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .execute()
    )

    if result.data and len(result.data) > 0:
        return result.data[0]["id"]

    new_session = (
        supabase.table("mentor_sessions")
        .insert({"task_id": task_id, "user_id": user_id})
        .execute()
    )

    if not new_session.data or len(new_session.data) == 0:
        raise ValueError(f"Failed to create mentor session for task {task_id} user {user_id}")

    return new_session.data[0]["id"]


def _get_chat_history(session_id: str, limit: int = 20) -> list:
    supabase = get_supabase()
    result = (
        supabase.table("mentor_messages")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return result.data or []


def _save_message(session_id: str, role: str, content: str):
    supabase = get_supabase()
    supabase.table("mentor_messages").insert({
        "session_id": session_id,
        "role": role,
        "content": content,
    }).execute()


async def stream_mentor_response(
    task_id: str, user_id: str, user_message: str
) -> AsyncGenerator[str, None]:
    task = _get_task(task_id)
    role = task.get("_role", "default")
    session_id = _get_or_create_session(task_id, user_id)

    _save_message(session_id, "user", user_message)

    system_prompt = build_system_prompt(
        role=role,
        task_title=task.get("title", ""),
        task_description=task.get("description", ""),
    )

    history = _get_chat_history(session_id, limit=20)
    history = history[:-1]  # exclude the message we just saved

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({
            "role": msg["role"] if msg["role"] != "assistant" else "assistant",
            "content": msg["content"]
        })
    messages.append({"role": "user", "content": user_message})

    full_response = ""
    stream = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        stream=True,
    )
    for chunk in stream:
        token = chunk.choices[0].delta.content or ""
        if token:
            full_response += token
            yield token
    _save_message(session_id, "assistant", full_response)


def get_session_history(task_id: str, user_id: str) -> list:
    supabase = get_supabase()
    result = (
        supabase.table("mentor_sessions")
        .select("id")
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        return []
    session_id = result.data["id"]
    return _get_chat_history(session_id, limit=100)