from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from app.schemas.team_hub import TeamRepoProvisionRequest, TeamRepoProvisionResponse
from app.services.team_hub import build_repo_provision_response

router = APIRouter(prefix="/api/github", tags=["github"])

@router.post("/team-repos/provision", response_model=TeamRepoProvisionResponse)
async def provision_team_repo(payload: TeamRepoProvisionRequest, current_user: dict = Depends(get_current_user)):
    return build_repo_provision_response(payload)

@router.get("/team-repos/template")
async def get_repo_template(current_user: dict = Depends(get_current_user)):
    return {
        "owner": current_user.get("github_username") or "internx-org",
        "template_repo": "internx-team-template",
        "recommended_branches": ["main", "develop"],
        "includes": ["README.md", ".github/pull_request_template.md", ".vscode/extensions.json"],
    }
