from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..deps import get_current_user, get_current_org, get_db
from ..models import Comment, Task
from ..schemas import CommentCreateIn, CommentOut


router = APIRouter(prefix="/comments", tags=["comments"])


@router.get("/task/{task_id}", response_model=list[CommentOut])
def list_comments(task_id: str, db: Session = Depends(get_db)):
    items = db.execute(select(Comment).where(Comment.task_id == task_id).order_by(Comment.created_at)).scalars().all()
    return items


@router.post("/task/{task_id}", response_model=CommentOut)
def create_comment(task_id: str, data: CommentCreateIn, db: Session = Depends(get_db), user=Depends(get_current_user), org=Depends(get_current_org)):
    task = db.get(Task, task_id)
    if not task or task.org_id != org.id:
        raise HTTPException(status_code=404, detail="Task not found")
    c = Comment(org_id=org.id, task_id=task_id, author_id=user.id, body=data.body)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

