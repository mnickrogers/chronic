from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..deps import get_current_user, get_current_org, get_db
from ..models import Workspace, WorkspaceMembership, User, OrgMembership
from ..schemas import WorkspaceCreateIn, WorkspaceOut, WorkspaceMemberOut, WorkspaceMemberAddIn, UserOut
from ..auth import hash_password


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


@router.get("/workspaces/{workspace_id}/members", response_model=list[WorkspaceMemberOut])
def list_workspace_members(workspace_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    ws = db.get(Workspace, workspace_id)
    if not ws or ws.org_id != org.id:
        raise HTTPException(status_code=404, detail="Workspace not found")
    memberships = db.execute(select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace_id)).scalars().all()
    results: list[WorkspaceMemberOut] = []
    for m in memberships:
        u = db.get(User, m.user_id)
        if u:
            results.append(WorkspaceMemberOut(user=UserOut.model_validate(u), role=m.role))
    return results


@router.post("/workspaces/{workspace_id}/members", response_model=WorkspaceMemberOut)
def add_workspace_member(
    workspace_id: str,
    data: WorkspaceMemberAddIn,
    db: Session = Depends(get_db),
    org=Depends(get_current_org),
):
    ws = db.get(Workspace, workspace_id)
    if not ws or ws.org_id != org.id:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not data.user_id and not data.email:
        raise HTTPException(status_code=400, detail="Provide user_id or email")

    # Resolve or create user
    user: User | None = None
    if data.user_id:
        user = db.get(User, data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
    else:
        # by email
        assert data.email is not None
        user = db.execute(select(User).where(User.email == data.email.lower())).scalar_one_or_none()
        if not user:
            display_name = data.display_name or (data.email.split("@")[0])
            # Best-effort split
            parts = [p for p in display_name.split(' ') if p]
            first = parts[0] if parts else display_name
            last = ' '.join(parts[1:]) if len(parts) > 1 else None
            user = User(
                email=data.email.lower(),
                password_hash=hash_password("invite-" + workspace_id),
                first_name=first,
                last_name=last,
                display_name=display_name,
            )
            db.add(user)
            db.flush()

    # Ensure user is in org
    om = db.execute(select(OrgMembership).where(OrgMembership.org_id == org.id, OrgMembership.user_id == user.id)).scalar_one_or_none()
    if not om:
        db.add(OrgMembership(org_id=org.id, user_id=user.id, role="member"))

    # Ensure workspace membership
    existing = db.execute(select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == user.id)).scalar_one_or_none()
    if not existing:
        existing = WorkspaceMembership(workspace_id=workspace_id, user_id=user.id, role="member")
        db.add(existing)

    db.commit()
    return WorkspaceMemberOut(user=UserOut.model_validate(user), role=existing.role)


@router.delete("/workspaces/{workspace_id}/members/{user_id}")
def remove_workspace_member(workspace_id: str, user_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    ws = db.get(Workspace, workspace_id)
    if not ws or ws.org_id != org.id:
        raise HTTPException(status_code=404, detail="Workspace not found")
    mem = db.execute(select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == user_id)).scalar_one_or_none()
    if not mem:
        raise HTTPException(status_code=404, detail="Membership not found")
    db.delete(mem)
    db.commit()
    return {"ok": True}
