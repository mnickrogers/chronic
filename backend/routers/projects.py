from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..deps import get_current_user, get_current_org, get_db
from ..models import Project, Workspace, ProjectStatus, ProjectMembership, WorkspaceMembership, User
from ..schemas import ProjectCreateIn, ProjectOut, ProjectStatusOut, ProjectMemberOut, ProjectMemberAddIn, UserOut
from ..realtime import manager


router = APIRouter(prefix="/projects", tags=["projects"])


def default_statuses(project_id: str):
    return [
        ProjectStatus(project_id=project_id, key="backlog", label="Backlog", position=0, is_done=False),
        ProjectStatus(project_id=project_id, key="in_progress", label="In Progress", position=1, is_done=False),
        ProjectStatus(project_id=project_id, key="blocked", label="Blocked", position=2, is_done=False),
        ProjectStatus(project_id=project_id, key="done", label="Done", position=3, is_done=True),
    ]


@router.get("/workspace/{workspace_id}", response_model=list[ProjectOut])
def list_projects(workspace_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    # org guard implicit in dev
    projects = db.execute(select(Project).where(Project.workspace_id == workspace_id)).scalars().all()
    return projects


@router.post("/workspace/{workspace_id}", response_model=ProjectOut)
def create_project(
    workspace_id: str,
    data: ProjectCreateIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    org=Depends(get_current_org),
):
    ws = db.get(Workspace, workspace_id)
    if not ws or ws.org_id != org.id:
        raise HTTPException(status_code=404, detail="Workspace not found")

    prj = Project(org_id=org.id, workspace_id=workspace_id, name=data.name, visibility=data.visibility, created_by=user.id)
    db.add(prj)
    db.flush()
    for st in default_statuses(prj.id):
        db.add(st)
    db.commit()
    db.refresh(prj)
    # Notify
    try:
        import anyio
        anyio.from_thread.run(manager.broadcast, f"workspace:{workspace_id}", {"type": "project.created", "project": ProjectOut.model_validate(prj).model_dump()})
    except Exception:
        pass
    return prj


@router.get("/{project_id}/statuses", response_model=list[ProjectStatusOut])
def get_statuses(project_id: str, db: Session = Depends(get_db)):
    sts = db.execute(select(ProjectStatus).where(ProjectStatus.project_id == project_id).order_by(ProjectStatus.position)).scalars().all()
    return sts


@router.get("/{project_id}/members", response_model=list[ProjectMemberOut])
def list_project_members(project_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    prj = db.get(Project, project_id)
    if not prj or prj.org_id != org.id:
        raise HTTPException(status_code=404, detail="Project not found")
    memberships = db.execute(select(ProjectMembership).where(ProjectMembership.project_id == project_id)).scalars().all()
    results: list[ProjectMemberOut] = []
    for m in memberships:
        u = db.get(User, m.user_id)
        if u:
            results.append(ProjectMemberOut(user=UserOut.model_validate(u), role=m.role))
    return results


@router.post("/{project_id}/members", response_model=ProjectMemberOut)
def add_project_member(
    project_id: str,
    data: ProjectMemberAddIn,
    db: Session = Depends(get_db),
    org=Depends(get_current_org),
):
    prj = db.get(Project, project_id)
    if not prj or prj.org_id != org.id:
        raise HTTPException(status_code=404, detail="Project not found")
    user = db.get(User, data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Ensure workspace membership so they’re discoverable for tagging
    ws_mem = db.execute(select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == prj.workspace_id, WorkspaceMembership.user_id == user.id)).scalar_one_or_none()
    if not ws_mem:
        ws_mem = WorkspaceMembership(workspace_id=prj.workspace_id, user_id=user.id, role="member")
        db.add(ws_mem)

    # Ensure project membership
    existing = db.execute(select(ProjectMembership).where(ProjectMembership.project_id == project_id, ProjectMembership.user_id == user.id)).scalar_one_or_none()
    if not existing:
        existing = ProjectMembership(project_id=project_id, user_id=user.id, role="editor")
        db.add(existing)

    db.commit()
    return ProjectMemberOut(user=UserOut.model_validate(user), role=existing.role)


@router.delete("/{project_id}/members/{user_id}")
def remove_project_member(project_id: str, user_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    prj = db.get(Project, project_id)
    if not prj or prj.org_id != org.id:
        raise HTTPException(status_code=404, detail="Project not found")
    mem = db.execute(select(ProjectMembership).where(ProjectMembership.project_id == project_id, ProjectMembership.user_id == user_id)).scalar_one_or_none()
    if not mem:
        raise HTTPException(status_code=404, detail="Membership not found")
    db.delete(mem)
    db.commit()
    return {"ok": True}
