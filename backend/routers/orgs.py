from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..deps import get_current_user, get_current_org, get_db
from ..models import Workspace, WorkspaceMembership
from ..schemas import WorkspaceCreateIn, WorkspaceOut


router = APIRouter(prefix="/orgs", tags=["orgs"])


@router.get("/current/workspaces", response_model=list[WorkspaceOut])
def list_workspaces(
    db: Session = Depends(get_db),
    org=Depends(get_current_org),
):
    wss = db.execute(select(Workspace).where(Workspace.org_id == org.id)).scalars().all()
    return wss


@router.post("/current/workspaces", response_model=WorkspaceOut)
def create_workspace(
    data: WorkspaceCreateIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    org=Depends(get_current_org),
):
    ws = Workspace(org_id=org.id, name=data.name, created_by=user.id)
    db.add(ws)
    db.flush()
    db.add(WorkspaceMembership(workspace_id=ws.id, user_id=user.id, role="admin"))
    db.commit()
    db.refresh(ws)
    return ws

