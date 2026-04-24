from typing import List, Literal
from pydantic import BaseModel, Field

Difficulty = Literal["easy", "medium", "hard"]

class TeamTemplate(BaseModel):
    role: Literal["frontend", "backend", "tester"]
    min_members: int
    max_members: int

class TeamRepoProvisionRequest(BaseModel):
    project_slug: str = Field(..., min_length=2)
    difficulty: Difficulty
    role: Literal["frontend", "backend", "tester"]
    team_number: int = Field(..., ge=1)
    members: List[str] = []

class TeamRepoProvisionResponse(BaseModel):
    repo_name: str
    repo_url: str
    default_branch: str
    invited_members: List[str]
    setup_status: str

class DashboardOverviewResponse(BaseModel):
    sprint_title: str
    project_name: str
    difficulty: Difficulty
    team_templates: List[TeamTemplate]
    modules: List[str]

class ReportUserRequest(BaseModel):
    reported_user_id: str
    reason: str
    details: str

class ReportUserResponse(BaseModel):
    status: str
    message: str

class NextProjectOption(BaseModel):
    title: str
    difficulty: Difficulty
    recommended_role: str
    summary: str
