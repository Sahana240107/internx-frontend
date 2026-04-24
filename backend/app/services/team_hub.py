from app.schemas.team_hub import DashboardOverviewResponse, NextProjectOption, TeamRepoProvisionRequest, TeamRepoProvisionResponse, TeamTemplate

TEAM_SIZE_TEMPLATES = {
    "easy": [
        TeamTemplate(role="frontend", min_members=1, max_members=1),
        TeamTemplate(role="backend", min_members=1, max_members=1),
        TeamTemplate(role="tester", min_members=1, max_members=1),
    ],
    "medium": [
        TeamTemplate(role="frontend", min_members=2, max_members=2),
        TeamTemplate(role="backend", min_members=2, max_members=2),
        TeamTemplate(role="tester", min_members=1, max_members=1),
    ],
    "hard": [
        TeamTemplate(role="frontend", min_members=3, max_members=3),
        TeamTemplate(role="backend", min_members=3, max_members=3),
        TeamTemplate(role="tester", min_members=2, max_members=2),
    ],
}


def build_dashboard_overview() -> DashboardOverviewResponse:
    return DashboardOverviewResponse(
        sprint_title="Sprint 04 - Multi-team product expansion",
        project_name="Team Commerce Workspace",
        difficulty="hard",
        team_templates=TEAM_SIZE_TEMPLATES["hard"],
        modules=["assigned-sprint", "guide", "setup", "chat", "calendar", "teammates", "review", "profile", "analytics", "report-user"],
    )


def build_repo_provision_response(payload: TeamRepoProvisionRequest) -> TeamRepoProvisionResponse:
    repo_name = f"internx-{payload.project_slug}-{payload.difficulty}-{payload.role[:2]}-{payload.team_number:02d}"
    return TeamRepoProvisionResponse(
        repo_name=repo_name,
        repo_url=f"https://github.com/internx-org/{repo_name}",
        default_branch="main",
        invited_members=payload.members,
        setup_status="scaffolded",
    )


def list_next_project_options() -> list[NextProjectOption]:
    return [
        NextProjectOption(title="AI Interview Scheduler", difficulty="medium", recommended_role="backend", summary="Scheduling flows, notifications, and interviewer coordination dashboards."),
        NextProjectOption(title="Intern Portfolio Studio", difficulty="easy", recommended_role="frontend", summary="Public profile polish, certificate UX, and personalization features."),
        NextProjectOption(title="Bug Triage Command Center", difficulty="hard", recommended_role="tester", summary="Reporting workflows, moderation queues, and release readiness checks."),
    ]
