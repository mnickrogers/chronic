from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..deps import get_current_org, get_db
from ..models import Tag, Workspace
from ..schemas import TagOut, TagCreateIn, TagUpdateIn
from ..realtime import manager


router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("/workspace/{workspace_id}", response_model=list[TagOut])
def list_tags(workspace_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    ws = db.get(Workspace, workspace_id)
    if not ws or ws.org_id != org.id:
        raise HTTPException(status_code=404, detail="Workspace not found")
    items = db.execute(select(Tag).where(Tag.workspace_id == workspace_id).order_by(Tag.name)).scalars().all()
    return items


@router.post("/workspace/{workspace_id}", response_model=TagOut)
def create_tag(workspace_id: str, data: TagCreateIn, db: Session = Depends(get_db), org=Depends(get_current_org)):
    ws = db.get(Workspace, workspace_id)
    if not ws or ws.org_id != org.id:
        raise HTTPException(status_code=404, detail="Workspace not found")
    # Enforce name uniqueness within workspace (case-insensitive via name_norm)
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    existing = db.execute(select(Tag).where(Tag.workspace_id == workspace_id, Tag.name_norm == name.lower())).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Tag with this name already exists")
    tag = Tag(org_id=org.id, workspace_id=workspace_id, name=name, name_norm=name.lower(), color=data.color or "#6B7280")
    db.add(tag)
    db.commit()
    db.refresh(tag)
    # Broadcast to workspace for filter bars
    try:
        import anyio
        anyio.from_thread.run(manager.broadcast, f"workspace:{workspace_id}", {"type": "tag.created", "tag": TagOut.model_validate(tag).model_dump()})
    except Exception:
        pass
    return tag


@router.patch("/{tag_id}", response_model=TagOut)
def update_tag(tag_id: str, data: TagUpdateIn, db: Session = Depends(get_db), org=Depends(get_current_org)):
    tag = db.get(Tag, tag_id)
    if not tag or tag.org_id != org.id:
        raise HTTPException(status_code=404, detail="Tag not found")
    if data.name is not None:
        name = (data.name or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name required")
        # Uniqueness within workspace (case-insensitive)
        exists = db.execute(select(Tag).where(Tag.workspace_id == tag.workspace_id, Tag.name_norm == name.lower(), Tag.id != tag.id)).scalar_one_or_none()
        if exists:
            raise HTTPException(status_code=409, detail="Tag with this name already exists")
        tag.name = name
        tag.name_norm = name.lower()
    if data.color is not None:
        tag.color = data.color
    db.commit()
    db.refresh(tag)
    try:
        import anyio
        anyio.from_thread.run(manager.broadcast, f"workspace:{tag.workspace_id}", {"type": "tag.updated", "tag": TagOut.model_validate(tag).model_dump()})
    except Exception:
        pass
    return tag


@router.delete("/{tag_id}")
def delete_tag(tag_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    tag = db.get(Tag, tag_id)
    if not tag or tag.org_id != org.id:
        raise HTTPException(status_code=404, detail="Tag not found")
    ws_id = tag.workspace_id
    tag_id = tag.id
    db.delete(tag)
    db.commit()
    try:
        import anyio
        anyio.from_thread.run(manager.broadcast, f"workspace:{ws_id}", {"type": "tag.deleted", "id": tag_id})
    except Exception:
        pass
    return {"ok": True}
