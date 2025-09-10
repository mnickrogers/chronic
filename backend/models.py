from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Text, Integer, Boolean, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy import JSON
from datetime import datetime, date
import uuid
from typing import Optional, List


def uuid4_str() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    name: Mapped[str] = mapped_column(String(255))
    primary_domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    users: Mapped[List["OrgMembership"]] = relationship(back_populates="org", cascade="all, delete-orphan")
    workspaces: Mapped[List["Workspace"]] = relationship(back_populates="org", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    memberships: Mapped[List["OrgMembership"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class OrgMembership(Base):
    __tablename__ = "org_memberships"
    __table_args__ = (UniqueConstraint("org_id", "user_id", name="uq_org_user"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(16), default="owner")  # owner/admin/member
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    org: Mapped[Organization] = relationship(back_populates="users")
    user: Mapped[User] = relationship(back_populates="memberships")


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    created_by: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    org: Mapped[Organization] = relationship(back_populates="workspaces")
    memberships: Mapped[List["WorkspaceMembership"]] = relationship(back_populates="workspace", cascade="all, delete-orphan")
    projects: Mapped[List["Project"]] = relationship(back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMembership(Base):
    __tablename__ = "workspace_memberships"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_ws_user"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(16), default="admin")  # admin/member
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    workspace: Mapped[Workspace] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship()


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    visibility: Mapped[str] = mapped_column(String(16), default="private")  # private/org_public
    created_by: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    workspace: Mapped[Workspace] = relationship(back_populates="projects")
    statuses: Mapped[List["ProjectStatus"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    sections: Mapped[List["ProjectSection"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    tasks: Mapped[List["Task"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class ProjectMembership(Base):
    __tablename__ = "project_memberships"
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_proj_user"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(16), default="editor")  # editor/viewer
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped[Project] = relationship()
    user: Mapped[User] = relationship()


class ProjectStatus(Base):
    __tablename__ = "project_statuses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(32))
    label: Mapped[str] = mapped_column(String(64))
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)

    project: Mapped[Project] = relationship(back_populates="statuses")


class ProjectSection(Base):
    __tablename__ = "project_sections"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128))
    position: Mapped[int] = mapped_column(Integer, default=0)

    project: Mapped[Project] = relationship(back_populates="sections")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    org_id: Mapped[str] = mapped_column(String)
    workspace_id: Mapped[str] = mapped_column(String)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    parent_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String(512))
    description: Mapped[Optional[dict]] = mapped_column(JSON, default=None)
    status_id: Mapped[Optional[str]] = mapped_column(ForeignKey("project_statuses.id", ondelete="SET NULL"))
    priority: Mapped[int] = mapped_column(Integer, default=2)  # 0..3
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    project: Mapped[Project] = relationship(back_populates="tasks")
    assignees: Mapped[List["TaskAssignee"]] = relationship(back_populates="task", cascade="all, delete-orphan")


class TaskAssignee(Base):
    __tablename__ = "task_assignees"
    __table_args__ = (UniqueConstraint("task_id", "user_id", name="uq_task_assignee"),)

    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    task: Mapped[Task] = relationship(back_populates="assignees")
    user: Mapped[User] = relationship()


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    org_id: Mapped[str] = mapped_column(String)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
