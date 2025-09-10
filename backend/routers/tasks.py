from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime

from ..deps import get_current_user, get_current_org, get_db
from ..models import Task, Project
from ..schemas import TaskCreateIn, TaskUpdateIn, TaskOut
from ..realtime import manager


router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/project/{project_id}", response_model=list[TaskOut])
def list_tasks(project_id: str, db: Session = Depends(get_db)):
    tasks = db.execute(select(Task).where(Task.project_id == project_id).order_by(Task.created_at.desc())).scalars().all()
    return tasks


@router.post("/project/{project_id}", response_model=TaskOut)
def create_task(
    project_id: str,
    data: TaskCreateIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    org=Depends(get_current_org),
):
    prj = db.get(Project, project_id)
    if not prj or prj.org_id != org.id:
        raise HTTPException(status_code=404, detail="Project not found")
    task = Task(
        id=None,
        org_id=org.id,
        workspace_id=prj.workspace_id,
        project_id=project_id,
        name=data.name,
        status_id=data.status_id,
        priority=data.priority,
        due_date=data.due_date,
        created_by=user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    # Broadcast
    try:
        import anyio
        payload = {"type": "task.created", "task": TaskOut.model_validate(task).model_dump()}
        anyio.from_thread.run(manager.broadcast, f"project:{project_id}", payload)
    except Exception:
        pass
    return task


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str,
    data: TaskUpdateIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    org=Depends(get_current_org),
):
    task = db.get(Task, task_id)
    if not task or task.org_id != org.id:
        raise HTTPException(status_code=404, detail="Task not found")
    if data.name is not None:
        task.name = data.name
    if data.status_id is not None:
        task.status_id = data.status_id
    if data.priority is not None:
        task.priority = data.priority
    if data.is_completed is not None:
        task.is_completed = data.is_completed
        task.completed_at = datetime.utcnow() if data.is_completed else None
    if data.due_date is not None:
        task.due_date = data.due_date
    db.commit()
    db.refresh(task)
    # Broadcast
    try:
        import anyio
        payload = {"type": "task.updated", "task": TaskOut.model_validate(task).model_dump()}
        anyio.from_thread.run(manager.broadcast, f"project:{task.project_id}", payload)
    except Exception:
        pass
    return task


@router.delete("/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    task = db.get(Task, task_id)
    if not task or task.org_id != org.id:
        raise HTTPException(status_code=404, detail="Task not found")
    project_id = task.project_id
    db.delete(task)
    db.commit()
    try:
        import anyio
        anyio.from_thread.run(manager.broadcast, f"project:{project_id}", {"type": "task.deleted", "id": task_id})
    except Exception:
        pass
    return {"ok": True}

