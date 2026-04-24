from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080

    # AI models
    gemini_api_key: str = ""
    groq_api_key: str = ""

    # GitHub OAuth (existing)
    github_client_id: str
    github_client_secret: str
    github_app_id: str = ""
    github_app_private_key: str = ""

    # ── NEW: GitHub Org (for multiplayer repo creation) ──────────
    # Create a PAT on the internx GitHub account with scopes:
    #   repo, write:org, admin:org
    # Then set GITHUB_ORG_TOKEN=ghp_xxx in .env
    github_org_token: str = ""
    github_org: str = "internx-hub"   # change to your actual org name

    # Resend Email
    resend_api_key: str = ""
    email_from: str = "noreply@internx.dev"

    # App
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    environment: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
