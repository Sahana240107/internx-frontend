from pydantic import BaseModel
from typing import Optional
from enum import Enum
from datetime import date, datetime


class TaskStatus(str, Enum):
    todo        = "todo"
    in_progress = "in_progress"
    review      = "review"
    done        = "done"


class TaskPriority(str, Enum):
    low    = "low"
    medium = "medium"
    high   = "high"


class InternRole(str, Enum):
    frontend  = "frontend"
    backend   = "backend"
    fullstack = "fullstack"
    devops    = "devops"
    design    = "design"


# ── SPRINT SCHEMAS ───────────────────────────────────────────────────────────

class SprintCreate(BaseModel):
    title:       str
    description: Optional[str] = None
    start_date:  date
    end_date:    date


class SprintUpdate(BaseModel):
    title:       Optional[str]  = None
    description: Optional[str]  = None
    start_date:  Optional[date] = None
    end_date:    Optional[date] = None
    is_active:   Optional[bool] = None


class SprintResponse(BaseModel):
    id:          str
    title:       str
    description: Optional[str]  = None
    start_date:  str
    end_date:    str
    is_active:   bool
    created_by:  str
    created_at:  str


# ── TASK SCHEMAS ─────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    """What a mentor sends when creating a new task."""
    title:        str
    description:  str
    sprint_id:    str
    assigned_to:  str                    # user_id of the intern
    intern_role:  InternRole             # which role this task is for
    priority:     TaskPriority = TaskPriority.medium
    due_date:     Optional[date] = None
    resources:    Optional[str]  = None  # links/docs the intern should read


class TaskUpdate(BaseModel):
    """Fields a mentor can update on a task."""
    title:       Optional[str]          = None
    description: Optional[str]          = None
    priority:    Optional[TaskPriority] = None
    due_date:    Optional[date]         = None
    resources:   Optional[str]          = None


class TaskStatusUpdate(BaseModel):
    """
    Used when moving a task through the state machine.
    Only the new status is needed — the backend validates the transition.
    """
    status: TaskStatus


class TaskSubmitPR(BaseModel):
    """Intern submits a GitHub PR URL to move their task to review."""
    pr_url: str


class TaskScore(BaseModel):
    """Mentor scores a completed task."""
    score:    int    # 0–100
    feedback: Optional[str] = None


class TaskResponse(BaseModel):
    id:           str
    title:        str
    description:  str
    sprint_id:    str
    assigned_to:  str
    intern_role:  str
    status:       str
    priority:     str
    due_date:     Optional[str] = None
    pr_url:       Optional[str] = None
    score:        Optional[int] = None
    feedback:     Optional[str] = None
    resources:    Optional[str] = None
    created_by:   Optional[str] = None
    created_at:   str
    updated_at:   str


class SprintProgressResponse(BaseModel):
    """Summary stats for a sprint — shown on the dashboard."""
    sprint_id:        str
    total_tasks:      int
    todo:             int
    in_progress:      int
    review:           int
    done:             int
    completion_rate:  float   # done / total * 100
    average_score:    Optional[float] = None
