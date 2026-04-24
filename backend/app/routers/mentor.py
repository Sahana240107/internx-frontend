"""
backend/app/routers/mentor.py
Complete mentor review router with Groq API support and proper async handling.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import json
from datetime import datetime
import traceback

from app.core.auth import get_current_user
from app.core.database import get_supabase
from app.services.mentor import review_pr_professional
from fastapi import WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/api/mentor", tags=["mentor"])


class ReviewRequest(BaseModel):
    task_id: str
    pr_url: str
    user_id: str


class ReviewResponse(BaseModel):
    status: str
    attempt_id: Optional[str] = None
    message: Optional[str] = None


@router.post("/review")
async def submit_review(
    request: ReviewRequest,
    background_tasks: BackgroundTasks
):
    """
    Submit a PR for AI review. Returns immediately with attempt ID.
    Actual review runs asynchronously.
    """
    supabase = get_supabase()

    try:
        print(f"\n[SUBMIT] New review request: task={request.task_id}, user={request.user_id}")

        # Validate user_id is present and non-empty before anything else.
        # An empty string will fail UUID validation in Supabase and leave the
        # task permanently stuck in 'review' if we've already updated the status.
        if not request.user_id or not request.user_id.strip():
            print(f"[SUBMIT] ❌ Rejected: user_id is missing or empty")
            return ReviewResponse(
                status="error",
                message="user_id is required. Please log in again."
            )

        # Validate PR URL
        if not isinstance(request.pr_url, str) or not request.pr_url.strip():
            return ReviewResponse(
                status="error",
                message="PR URL is required"
            )

        # Fetch task
        print(f"[SUBMIT] Fetching task {request.task_id}...")
        task_result = supabase.table("tasks")\
            .select("*")\
            .eq("id", request.task_id)\
            .single()\
            .execute()

        if not task_result.data:
            return ReviewResponse(
                status="error",
                message="Task not found"
            )

        task = task_result.data
        print(f"[SUBMIT] ✓ Found task: {task.get('title')}")

        # Create review_attempts record BEFORE updating the task status.
        # Previously, the task was set to 'review' first — so if the DB insert
        # failed the background task never ran and the task was permanently stuck.
        print(f"[SUBMIT] Creating review_attempts record...")
        attempt_result = supabase.table("review_attempts").insert({
            "task_id": request.task_id,
            "user_id": request.user_id.strip(),
            "pr_url": request.pr_url.strip(),
            "ai_model": "llama-3.3-70b-versatile",
            "created_at": datetime.utcnow().isoformat()
        }).execute()

        if not attempt_result.data:
            print(f"[SUBMIT] ❌ Failed to create attempt record")
            return ReviewResponse(
                status="error",
                message="Failed to create review attempt"
            )

        attempt_id = attempt_result.data[0]["id"]
        print(f"[SUBMIT] ✓ Created attempt: {attempt_id}")

        # Only update the task status to 'review' now that the attempt record
        # exists and the background task is guaranteed to be queued.
        print(f"[SUBMIT] Setting task status to 'review'...")
        supabase.table("tasks").update({
            "status": "review",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", request.task_id).execute()

        # Queue background task
        print(f"[SUBMIT] Queueing background review task...")
        background_tasks.add_task(
            run_review_background,
            task_id=request.task_id,
            user_id=request.user_id.strip(),
            pr_url=request.pr_url.strip(),
            attempt_id=attempt_id,
            task_title=task.get("title", ""),
            task_description=task.get("description", "")
        )

        print(f"[SUBMIT] ✓ Review submission complete\n")

        return ReviewResponse(
            status="queued",
            attempt_id=attempt_id,
            message="Review queued. Please wait ~15 seconds."
        )

    except Exception as e:
        print(f"[SUBMIT] ❌ Error: {e}")
        print(traceback.format_exc())
        return ReviewResponse(
            status="error",
            message=f"Error: {str(e)}"
        )


@router.get("/review/history/{task_id}")
async def get_review_history(task_id: str):
    """
    Get all review attempts for a task.
    """
    supabase = get_supabase()

    try:
        print(f"[HISTORY] Fetching history for task {task_id}")

        result = supabase.table("review_attempts")\
            .select("*")\
            .eq("task_id", task_id)\
            .order("created_at", desc=True)\
            .execute()

        print(f"[HISTORY] ✓ Found {len(result.data or [])} attempts")

        return {
            "attempts": result.data or [],
            "count": len(result.data or [])
        }

    except Exception as e:
        print(f"[HISTORY] ❌ Error: {e}")
        return {
            "attempts": [],
            "count": 0,
            "error": str(e)
        }


@router.get("/review/attempt/{attempt_id}")
async def get_review_attempt(attempt_id: str):
    """
    Get a specific review attempt.
    """
    supabase = get_supabase()

    try:
        result = supabase.table("review_attempts")\
            .select("*")\
            .eq("id", attempt_id)\
            .single()\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Review attempt not found")

        return result.data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Background Task ─────────────────────────────────────────────────────────

def run_review_background(
    task_id: str,
    user_id: str,
    pr_url: str,
    attempt_id: str,
    task_title: str,
    task_description: str
):
    """
    Background task to run AI review.
    This runs asynchronously and updates the database.
    """
    supabase = get_supabase()

    print(f"\n[BG_TASK] Starting review for task {task_id}")
    print(f"[BG_TASK] Attempt ID: {attempt_id}")

    try:
        # Run professional review
        print(f"[BG_TASK] Calling review_pr_professional()...")
        review_result = review_pr_professional(
            task_id=task_id,
            pr_url=pr_url,
            task_description=task_description,
            task_title=task_title
        )

        print(f"[BG_TASK] ✓ Review completed: {review_result.get('verdict')}")

        # Ensure review_json is serializable
        review_json_safe = json.loads(json.dumps(review_result, default=str))

        # FIX: review_attempts table has no 'updated_at' column — removed it.
        # Only update the columns that actually exist in the schema.
        print(f"[BG_TASK] Updating review_attempts record...")
        supabase.table("review_attempts").update({
            "score": review_result.get("score"),
            "verdict": review_result.get("verdict"),
            "confidence": float(review_result.get("confidence", 0.5)),
            "review_json": review_json_safe,
        }).eq("id", attempt_id).execute()

        print(f"[BG_TASK] ✓ Updated attempt record")

        # Determine new task status
        verdict = review_result.get("verdict")
        blocking_issues = review_result.get("blocking_issues", [])
        critical_blocks = [b for b in blocking_issues if b.get("severity") == "critical"]

        new_status = "done" if verdict == "pass" and not critical_blocks else "in_progress"

        # Update task with latest review info
        print(f"[BG_TASK] Updating task status to '{new_status}'...")

        feedback_data = {
            "latest_review": review_result,
            "verdict": verdict,
            "score": review_result.get("score"),
            "updated_at": datetime.utcnow().isoformat()
        }

        supabase.table("tasks").update({
            "status": new_status,
            "score": review_result.get("score"),
            "feedback": json.dumps(feedback_data, default=str),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", task_id).execute()

        print(f"[BG_TASK] ✓ Updated task status: {new_status}")
        print(f"[BG_TASK] ✅ Background task complete\n")

    except Exception as e:
        print(f"[BG_TASK] ❌ Error during review: {e}")
        print(traceback.format_exc())

        # Revert task to in_progress so the user can resubmit
        try:
            supabase.table("tasks").update({
                "status": "in_progress",
                "feedback": json.dumps({
                    "error": str(e),
                    "error_at": datetime.utcnow().isoformat()
                }),
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", task_id).execute()

            # FIX: Only update columns that exist in review_attempts schema.
            supabase.table("review_attempts").update({
                "score": 0,
                "verdict": "resubmit",
                "review_json": {
                    "error": str(e),
                    "error_type": type(e).__name__
                },
            }).eq("id", attempt_id).execute()
        except Exception:
            pass

        print(f"[BG_TASK] ❌ Task reverted to in_progress\n")

# ai chatbot
# ── Chatbot Endpoints ────────────────────────────────────────────────────────

class ProjectChatRequest(BaseModel):
    message: str
    user_id: str
    project_context: str = ""


@router.post("/project-chat")
async def project_chat(body: ProjectChatRequest):
    """REST endpoint for project-level mentor chat (no task ID needed)."""
    from groq import Groq
    from app.core.config import get_settings

    settings = get_settings()
    ai_client = Groq(api_key=settings.groq_api_key)

    system_prompt = f"""You are an AI mentor for a software engineering intern on InternX.

The intern is working on this project:
{body.project_context}

Help them understand the project, plan their work, answer technical questions, and guide them through their internship.
Be specific to this project context. Keep answers concise and practical."""

    response = ai_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": body.message}
        ],
    )
    return {"reply": response.choices[0].message.content}


@router.websocket("/chat/{task_id}")
async def mentor_chat(task_id: str, websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            user_message = data.get("message", "")
            user_id = data.get("user_id", "")

            if not user_message or not user_id:
                await websocket.send_text("[ERROR] Missing message or user_id")
                continue

            from app.services.mentor_chat import stream_mentor_response
            async for token in stream_mentor_response(
                task_id=task_id,
                user_id=user_id,
                user_message=user_message,
            ):
                await websocket.send_text(token)

            await websocket.send_text("[DONE]")

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_text(f"[ERROR] {str(e)}")
        await websocket.close()


@router.get("/sessions/{task_id}")
async def get_chat_history(task_id: str):
    from app.services.mentor_chat import get_session_history
    supabase = get_supabase()
    # Get user_id from query would require Depends, simplified here
    return {"task_id": task_id, "messages": []}


@router.get("/summary/{user_id}")
async def get_learning_summary(user_id: str):
    from groq import Groq
    from app.core.config import get_settings

    settings = get_settings()
    ai_client = Groq(api_key=settings.groq_api_key)
    supabase = get_supabase()

    tasks_result = (
        supabase.table("tasks")
        .select("title, description, score, feedback")
        .eq("assigned_to", user_id)
        .eq("status", "done")
        .execute()
    )
    tasks = tasks_result.data or []

    if not tasks:
        return {"summary": "No completed tasks yet."}

    task_list = "\n".join(
        f"- {t['title']} (score: {t.get('score', 'N/A')}): {t.get('feedback', '')}"
        for t in tasks
    )

    prompt = f"""
A software engineering intern has completed these tasks:
{task_list}

Write a 3-paragraph professional learning summary for their portfolio.
Highlight skills demonstrated, improvement over time, and readiness for real internships.
Keep it encouraging and specific.
""".strip()

    response = ai_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
    )
    return {"summary": response.choices[0].message.content}