from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import datetime

from ..deps import get_current_user, get_current_org, get_db
from ..models import Task, Project, ProjectStatus, Workspace, TaskAssignee, User, ProjectMembership, WorkspaceMembership, Tag, TaskTag
from ..schemas import TaskCreateIn, TaskUpdateIn, TaskOut, TaskAssigneeOut, TaskAssigneeAddIn, UserOut, TagOut, TaskTagsBatchIn
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


@router.get("/workspace/{workspace_id}", response_model=list[TaskOut])
def list_workspace_tasks(workspace_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    items = db.execute(select(Task).where(Task.workspace_id == workspace_id).order_by(Task.created_at.desc())).scalars().all()
    return items


@router.post("/workspace/{workspace_id}", response_model=TaskOut)
def create_workspace_task(
    workspace_id: str,
    data: TaskCreateIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    org=Depends(get_current_org),
):
    ws = db.get(Workspace, workspace_id)
    if not ws or ws.org_id != org.id:
        raise HTTPException(status_code=404, detail="Workspace not found")
    prj = db.get(Project, data.project_id) if data.project_id else None
    if prj and prj.org_id != org.id:
        raise HTTPException(status_code=404, detail="Project not found")
    task = Task(
        id=None,
        org_id=org.id,
        workspace_id=workspace_id,
        project_id=prj.id if prj else None,
        name=data.name,
        status_id=data.status_id,
        priority=data.priority,
        due_date=data.due_date,
        created_by=user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    try:
        import anyio
        if task.project_id:
            anyio.from_thread.run(manager.broadcast, f"project:{task.project_id}", {"type": "task.created", "task": TaskOut.model_validate(task).model_dump()})
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
    old_project_id = task.project_id
    # Handle project move
    if data.project_id is not None and data.project_id != task.project_id:
        new_prj = db.get(Project, data.project_id)
        if not new_prj or new_prj.org_id != org.id:
            raise HTTPException(status_code=404, detail="Project not found")
        task.project_id = new_prj.id
        task.workspace_id = new_prj.workspace_id
        # Ensure status is valid in target project
        target_statuses = db.execute(select(ProjectStatus).where(ProjectStatus.project_id == new_prj.id).order_by(ProjectStatus.position)).scalars().all()
        target_ids = {s.id for s in target_statuses}
        if data.status_id is not None and data.status_id in target_ids:
            task.status_id = data.status_id
        elif task.status_id not in target_ids:
            # default to first status if current status invalid for new project
            if target_statuses:
                task.status_id = target_statuses[0].id
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
    if data.description is not None:
        task.description = data.description
    db.commit()
    db.refresh(task)
    # If moved into a project, grant existing assignees access to the project and workspace
    if data.project_id is not None and data.project_id != old_project_id and task.project_id:
        assignees = db.execute(select(TaskAssignee).where(TaskAssignee.task_id == task.id)).scalars().all()
        for a in assignees:
            # Ensure workspace membership
            ws_mem = db.execute(select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == task.workspace_id, WorkspaceMembership.user_id == a.user_id)).scalar_one_or_none()
            if not ws_mem:
                db.add(WorkspaceMembership(workspace_id=task.workspace_id, user_id=a.user_id, role="member"))
            # Ensure project membership
            pm = db.execute(select(ProjectMembership).where(ProjectMembership.project_id == task.project_id, ProjectMembership.user_id == a.user_id)).scalar_one_or_none()
            if not pm:
                db.add(ProjectMembership(project_id=task.project_id, user_id=a.user_id, role="editor"))
        db.commit()
    # Broadcast
    try:
        import anyio
        # If moved, notify old project as deletion and new as creation for simpler client handling
        if data.project_id is not None and data.project_id != old_project_id:
            anyio.from_thread.run(manager.broadcast, f"project:{old_project_id}", {"type": "task.deleted", "id": task_id})
            anyio.from_thread.run(manager.broadcast, f"project:{task.project_id}", {"type": "task.created", "task": TaskOut.model_validate(task).model_dump()})
        else:
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


@router.get("/{task_id}/assignees", response_model=list[UserOut])
def list_task_assignees(task_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    task = db.get(Task, task_id)
    if not task or task.org_id != org.id:
        raise HTTPException(status_code=404, detail="Task not found")
    assocs = db.execute(select(TaskAssignee).where(TaskAssignee.task_id == task_id)).scalars().all()
    users: list[UserOut] = []
    for a in assocs:
        u = db.get(User, a.user_id)
        if u:
            users.append(UserOut.model_validate(u))
    return users


@router.post("/{task_id}/assignees", response_model=list[UserOut])
def add_task_assignee(
    task_id: str,
    data: TaskAssigneeAddIn,
    db: Session = Depends(get_db),
    org=Depends(get_current_org),
):
    task = db.get(Task, task_id)
    if not task or task.org_id != org.id:
        raise HTTPException(status_code=404, detail="Task not found")
    user = db.get(User, data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Ensure workspace membership so tasks show up for them
    ws_mem = db.execute(select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == task.workspace_id, WorkspaceMembership.user_id == user.id)).scalar_one_or_none()
    if not ws_mem:
        db.add(WorkspaceMembership(workspace_id=task.workspace_id, user_id=user.id, role="member"))

    # Add assignee link if missing
    existing = db.execute(select(TaskAssignee).where(TaskAssignee.task_id == task_id, TaskAssignee.user_id == user.id)).scalar_one_or_none()
    if not existing:
        db.add(TaskAssignee(task_id=task_id, user_id=user.id))

    # If task is in a project, ensure project access
    if task.project_id:
        pm = db.execute(select(ProjectMembership).where(ProjectMembership.project_id == task.project_id, ProjectMembership.user_id == user.id)).scalar_one_or_none()
        if not pm:
            db.add(ProjectMembership(project_id=task.project_id, user_id=user.id, role="editor"))

    db.commit()
    # Return full list of assignees
    assocs = db.execute(select(TaskAssignee).where(TaskAssignee.task_id == task_id)).scalars().all()
    users: list[UserOut] = []
    for a in assocs:
        u = db.get(User, a.user_id)
        if u:
            users.append(UserOut.model_validate(u))
    return users


@router.delete("/{task_id}/assignees/{user_id}")
def remove_task_assignee(task_id: str, user_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    task = db.get(Task, task_id)
    if not task or task.org_id != org.id:
        raise HTTPException(status_code=404, detail="Task not found")
    assoc = db.execute(select(TaskAssignee).where(TaskAssignee.task_id == task_id, TaskAssignee.user_id == user_id)).scalar_one_or_none()
    if not assoc:
        raise HTTPException(status_code=404, detail="Assignee not found")
    db.delete(assoc)
    db.commit()
    return {"ok": True}


# ----- Task Tags -----

@router.get("/{task_id}/tags", response_model=list[TagOut])
def list_task_tags(task_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    task = db.get(Task, task_id)
    if not task or task.org_id != org.id:
        raise HTTPException(status_code=404, detail="Task not found")
    joins = db.execute(select(TaskTag).where(TaskTag.task_id == task_id)).scalars().all()
    tags: list[Tag] = []
    for j in joins:
        t = db.get(Tag, j.tag_id)
        if t:
            tags.append(t)
    return tags


@router.post("/{task_id}/tags", response_model=list[TagOut])
def add_task_tag(task_id: str, body: dict, db: Session = Depends(get_db), org=Depends(get_current_org)):
    task = db.get(Task, task_id)
    if not task or task.org_id != org.id:
        raise HTTPException(status_code=404, detail="Task not found")
    tag_id = body.get("tag_id")
    if not tag_id:
        raise HTTPException(status_code=400, detail="tag_id required")
    tag = db.get(Tag, tag_id)
    if not tag or tag.org_id != org.id or tag.workspace_id != task.workspace_id:
        raise HTTPException(status_code=404, detail="Tag not found in this workspace")
    existing = db.execute(select(TaskTag).where(TaskTag.task_id == task.id, TaskTag.tag_id == tag.id)).scalar_one_or_none()
    if not existing:
        db.add(TaskTag(task_id=task.id, tag_id=tag.id))
        db.commit()
    # return list
    joins = db.execute(select(TaskTag).where(TaskTag.task_id == task.id)).scalars().all()
    out: list[Tag] = []
    for j in joins:
        t = db.get(Tag, j.tag_id)
        if t:
            out.append(t)
    return out


@router.delete("/{task_id}/tags/{tag_id}")
def remove_task_tag(task_id: str, tag_id: str, db: Session = Depends(get_db), org=Depends(get_current_org)):
    task = db.get(Task, task_id)
    if not task or task.org_id != org.id:
        raise HTTPException(status_code=404, detail="Task not found")
    assoc = db.execute(select(TaskTag).where(TaskTag.task_id == task.id, TaskTag.tag_id == tag_id)).scalar_one_or_none()
    if not assoc:
        raise HTTPException(status_code=404, detail="Tag not attached")
    db.delete(assoc)
    db.commit()
    return {"ok": True}


@router.post("/tags/batch", response_model=dict[str, list[TagOut]])
def list_tags_for_tasks(body: TaskTagsBatchIn, db: Session = Depends(get_db), org=Depends(get_current_org)):
    if not body.task_ids:
        return {}
    # Fetch tasks to enforce org scope
    tasks = db.execute(select(Task.id, Task.org_id).where(Task.id.in_(body.task_ids))).all()
    allowed_ids = {tid for (tid, o) in tasks if o == org.id}
    if not allowed_ids:
        return {}
    joins = db.execute(select(TaskTag).where(TaskTag.task_id.in_(allowed_ids))).scalars().all()
    tag_ids = {j.tag_id for j in joins}
    tags = db.execute(select(Tag).where(Tag.id.in_(tag_ids))).scalars().all() if tag_ids else []
    tags_by_id = {t.id: t for t in tags}
    out: dict[str, list[Tag]] = {tid: [] for tid in allowed_ids}
    for j in joins:
        t = tags_by_id.get(j.tag_id)
        if t:
            out[j.task_id].append(t)
    return out


@router.get("/search", response_model=list[TaskOut])
def search_tasks_by_tags(
    workspace_id: str,
    tag_ids: str | None = None,  # comma-separated
    mode: str = "and",  # 'and' or 'or'
    db: Session = Depends(get_db),
    org=Depends(get_current_org),
):
    # Ensure workspace belongs to org
    ws = db.get(Workspace, workspace_id)
    if not ws or ws.org_id != org.id:
        raise HTTPException(status_code=404, detail="Workspace not found")
    ids = [x for x in (tag_ids.split(',') if tag_ids else []) if x]
    base = select(Task).where(Task.workspace_id == workspace_id)
    if not ids:
        return db.execute(base.order_by(Task.created_at.desc())).scalars().all()
    jt = select(Task.id.label('tid')).join_from(Task, TaskTag, Task.id == TaskTag.task_id).where(Task.workspace_id == workspace_id, TaskTag.tag_id.in_(ids)).group_by(Task.id)
    if mode.lower() == 'and':
        jt = jt.having(func.count(func.distinct(TaskTag.tag_id)) == len(ids))
    # Join to tasks from subquery
    q = select(Task).join(jt.subquery(), jt.subquery().c.tid == Task.id).order_by(Task.created_at.desc())
    items = db.execute(q).scalars().all()
    return items
