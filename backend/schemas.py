from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, date


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: EmailStr
    first_name: Optional[str]
    last_name: Optional[str]
    display_name: str
    created_at: datetime


class AuthSignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    first_name: str
    last_name: str


class AuthLoginIn(BaseModel):
    email: EmailStr
    password: str


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    primary_domain: Optional[str]
    created_at: datetime


class WorkspaceCreateIn(BaseModel):
    name: str


class WorkspaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    org_id: str
    created_at: datetime


class ProjectCreateIn(BaseModel):
    name: str
    visibility: str = "private"


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    visibility: str
    workspace_id: str
    org_id: str
    created_at: datetime


class ProjectStatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    key: str
    label: str
    position: int
    is_done: bool


class TaskCreateIn(BaseModel):
    name: str
    status_id: Optional[str] = None
    priority: int = 2
    due_date: Optional[date] = None
    project_id: Optional[str] = None
    workspace_id: Optional[str] = None


class TaskUpdateIn(BaseModel):
    name: Optional[str] = None
    status_id: Optional[str] = None
    priority: Optional[int] = None
    is_completed: Optional[bool] = None
    due_date: Optional[date] = None
    project_id: Optional[str] = None
    description: Optional[dict] = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    project_id: Optional[str]
    status_id: Optional[str]
    priority: int
    is_completed: bool
    due_date: Optional[date]
    created_at: datetime
    description: Optional[dict]


class CommentCreateIn(BaseModel):
    body: dict


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    task_id: str
    author_id: str
    body: dict
    created_at: datetime


class SessionOut(BaseModel):
    user: UserOut
    org: OrganizationOut


class MeUpdateIn(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    # For backward compatibility, allow display_name; server will map it.
    display_name: Optional[str] = None


# Workspace members
class WorkspaceMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user: UserOut
    role: str


class WorkspaceMemberAddIn(BaseModel):
    user_id: Optional[str] = None
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None


# Project members
class ProjectMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user: UserOut
    role: str


class ProjectMemberAddIn(BaseModel):
    user_id: str


# Task assignees
class TaskAssigneeAddIn(BaseModel):
    user_id: str

class TaskAssigneeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user: UserOut


# Tags
class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    color: Optional[str]
    workspace_id: str
    org_id: str
    created_at: datetime


class TagCreateIn(BaseModel):
    name: str
    color: Optional[str] = None


class TagUpdateIn(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class TaskTagsBatchIn(BaseModel):
    task_ids: List[str]
