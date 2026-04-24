from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from app.schemas.team_hub import DashboardOverviewResponse, ReportUserRequest, ReportUserResponse
from app.services.team_hub import build_dashboard_overview, list_next_project_options

router = APIRouter(prefix="/api/team-hub", tags=["team-hub"])

@router.get("/overview", response_model=DashboardOverviewResponse)
async def get_dashboard_overview(current_user: dict = Depends(get_current_user)):
    return build_dashboard_overview()

@router.get("/guide")
async def get_shared_guide(current_user: dict = Depends(get_current_user)):
    return {"title": "Guide to All", "sections": ["Project overview", "Role responsibilities", "GitHub workflow", "Review checklist"]}

@router.get("/calendar")
async def get_calendar(current_user: dict = Depends(get_current_user)):
    return {"items": [{"name": "Sprint 03 retrospective", "date": "2026-04-16", "type": "previous"}, {"name": "Sprint 04 planning", "date": "2026-04-21", "type": "current"}, {"name": "Sprint 04 demo review", "date": "2026-04-28", "type": "upcoming"}]}

@router.get("/analytics")
async def get_analytics(current_user: dict = Depends(get_current_user)):
    return {"velocity": 21, "on_time_completion": 83, "review_score": 8.6, "rework_items": 4}

@router.post("/report-user", response_model=ReportUserResponse)
async def report_user(payload: ReportUserRequest, current_user: dict = Depends(get_current_user)):
    return ReportUserResponse(status="received", message=f"Report for user {payload.reported_user_id} has been captured for review.")

@router.get("/projects/next")
async def get_next_projects(current_user: dict = Depends(get_current_user)):
    return list_next_project_options()
