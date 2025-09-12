from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..deps import get_current_org, get_db
from ..models import Tag, Workspace
from ..schemas import TagOut, TagCreateIn, TagUpdateIn


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
    # Enforce name uniqueness within workspace (case sensitive at DB level)
    existing = db.execute(select(Tag).where(Tag.workspace_id == workspace_id, Tag.name == data.name)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Tag with this name already exists")
    tag = Tag(org_id=org.id, workspace_id=workspace_id, name=data.name.strip(), color=data.color or "#6B7280")
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.patch("/{tag_id}", response_model=TagOut)
def update_tag(tag_id: str, data: TagUpdateIn, db: Session = Depends(get_db), org=Depends(get_current_org)):
    tag = db.get(Tag, tag_id)
    if not tag or tag.org_id != org.id:
        raise HTTPException(status_code=404, detail="Tag not found")
    if data.name is not None:
        # Uniqueness within workspace
        exists = db.execute(select(Tag).where(Tag.workspace_id == tag.workspace_id, Tag.name == data.name, Tag.id != tag.id)).scalar_one_or_none()
        if exists:
            raise HTTPException(status_code=409, detail="Tag with this name already exists")
        tag.name = data.name.strip()
    if data.color is not None:
        tag.color = data.color
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/{tag_id}")
def delete_tag(tag_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    tag = db.get(Tag, tag_id)
    if not tag or tag.org_id != org.id:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()
    return {"ok": True}

