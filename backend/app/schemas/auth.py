from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum


class Role(str, Enum):
    intern = "intern"
    mentor = "mentor"
    admin  = "admin"


class InternRole(str, Enum):
    frontend  = "frontend"
    backend   = "backend"
    fullstack = "fullstack"
    devops    = "devops"
    design    = "design"
    tester    = "tester"   # added — QA/Tester role used throughout the app


class GitHubCallbackRequest(BaseModel):
    """
    Sent from the frontend after GitHub redirects back with a code.
    GitHub gives us a one-time 'code' — we exchange it for an access token.
    """
    code: str


class ProfileUpdate(BaseModel):
    """Fields an intern can update on their own profile."""
    name:            Optional[str]        = None
    bio:             Optional[str]        = None
    intern_role:     Optional[InternRole] = None
    github_username: Optional[str]        = None


class RoleAssignRequest(BaseModel):
    """Only admins use this — to change another user's role."""
    user_id: str
    role:    Role


class UserResponse(BaseModel):
    """What the API returns when asked about a user. Never includes passwords."""
    id:               str
    email:            str
    name:             str
    avatar_url:       Optional[str]        = None
    github_username:  Optional[str]        = None
    role:             Role
    intern_role:      Optional[InternRole] = None
    bio:              Optional[str]        = None
    project_id:       Optional[str]        = None
    cohort_id:        Optional[str]        = None
    team_role:        Optional[str]        = None
    created_at:       str


class TokenResponse(BaseModel):
    """Returned after successful login."""
    access_token: str
    token_type:   str = "bearer"
    user:         UserResponse