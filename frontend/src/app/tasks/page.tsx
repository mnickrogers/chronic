"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import AppShell, { useCurrentWorkspace } from "@/components/AppShell";
import TaskList, { Task, Project, Status } from "@/components/TaskList";
import TaskBoard from "@/components/TaskBoard";
import ViewToggle from "@/components/ViewToggle";
import { useTaskViewMode } from "@/lib/view-mode";
import TaskDetail from "@/components/TaskDetail";
import { api } from "@/lib/api";
import { DEFAULT_STATUSES } from "@/lib/default-statuses";
import TagFilter from "@/components/TagFilter";

export default function AllTasksPage() {
  return (
    <AppShell>
      <AllTasksInner />
    </AppShell>
  );
}

function AllTasksInner() {
  const { workspaceId } = useCurrentWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [statusesByProject, setStatusesByProject] = useState<Record<string, Status[]>>({});
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [assigneesByTask, setAssigneesByTask] = useState<Record<string, any[]>>({});
  const [tagsByTask, setTagsByTask] = useState<Record<string, any[]>>({});
  const [workspaceTags, setWorkspaceTags] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [viewMode, setViewMode] = useTaskViewMode();

  // Load projects and all tasks in the current workspace
  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      try {
        const prjs = await api.listProjects(workspaceId);
        setProjects(prjs);
        // All tasks in workspace, including those with no project
        const all:any[] = await api.listWorkspaceTasks(workspaceId) as any;
        setTasks(all as any);
        // Load statuses for each project and keep both flattened and by-project
        const statusGroups = await Promise.all(prjs.map(async (p:any) => ({ id: p.id, statuses: await api.getStatuses(p.id) })));
        const flat: Record<string, Status> = {};
        const byProject: Record<string, Status[]> = {};
        statusGroups.forEach(({id, statuses}) => { byProject[id] = statuses as any; (statuses as any).forEach((s:any)=>{ flat[s.id] = s; }); });
        // Also include default statuses so tasks without a project always have options
        for (const s of DEFAULT_STATUSES) flat[s.id] = s as any;
        setStatuses(flat);
        setStatusesByProject(byProject);
        try {
          const assigneeEntries = await Promise.all((all as any[]).map(async (t:any)=> [t.id, await api.listTaskAssignees(t.id)]));
          setAssigneesByTask(Object.fromEntries(assigneeEntries));
        } catch {}
        try {
          const ids = (all as any[]).map((t:any)=>t.id);
          const batch = ids.length ? await api.listTagsForTasks(ids) as any : {};
          setTagsByTask(batch);
        } catch {}
        try {
          setWorkspaceTags(await api.listTags(workspaceId) as any);
        } catch {}
      } catch {}
    })();
  }, [workspaceId]);

  // Live updates for workspace tags
  useEffect(() => {
    if (!workspaceId) return;
    const ws = new WebSocket((process.env.NEXT_PUBLIC_WS_BASE || 'ws://localhost:8000') + '/ws');
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ subscribe: `workspace:${workspaceId}` }));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'tag.created') setWorkspaceTags(prev => {
        // Avoid dup by id
        if (prev.some((t:any)=>t.id===msg.tag.id)) return prev;
        return [...prev, msg.tag];
      });
      if (msg.type === 'tag.updated') setWorkspaceTags(prev => prev.map((t:any)=> t.id===msg.tag.id ? msg.tag : t));
      if (msg.type === 'tag.deleted') setWorkspaceTags(prev => prev.filter((t:any)=> t.id !== msg.id));
    };
    return () => { try { ws.close(); } catch {} };
  }, [workspaceId]);

  const projectsById = useMemo(() => Object.fromEntries(projects.map((p:any)=>[p.id, p])), [projects]);
  const statusIdToProjectId = useMemo(() => {
    const m: Record<string, string> = {};
    Object.entries(statusesByProject).forEach(([pid, sts]) => { (sts||[]).forEach((s:any)=>{ m[s.id] = pid; }); });
    return m;
  }, [statusesByProject]);
  const filteredTasks = useMemo(() => {
    if (selectedTags.length === 0) return tasks;
    return tasks.filter(t => (tagsByTask[t.id]||[]).some((tg:any)=> selectedTags.includes(tg.id)));
  }, [tasks, tagsByTask, selectedTags]);

  const toggle = async (t: Task, next: boolean) => {
    const updated = await api.updateTask(t.id, { is_completed: next });
    setTasks(prev=>prev.map(x=>x.id===t.id? (updated as any): x));
  };

  const createNew = async () => {
    if (!workspaceId) return;
    const t = await api.createWorkspaceTask(workspaceId, 'Untitled Task', null, DEFAULT_STATUSES[0].id);
    setTasks(prev=>[t as any, ...prev]);
    setAssigneesByTask(prev=>({ ...prev, [(t as any).id]: [] }));
    setTagsByTask(prev=>({ ...prev, [(t as any).id]: [] }));
    setOpenTask(t as any);
  };

  const createInStatus = async (statusId: string | null) => {
    if (!workspaceId) return;
    try {
      // If status belongs to a project, create inside that project. If default or null → workspace task.
      const projectId = statusId ? statusIdToProjectId[statusId] : null;
      if (projectId) {
        const t:any = await api.createTask(projectId, 'Untitled Task', statusId || undefined);
        setTasks(prev=>[t, ...prev]);
        setAssigneesByTask(prev=>({ ...prev, [t.id]: [] }));
        setTagsByTask(prev=>({ ...prev, [t.id]: [] }));
        setOpenTask(t);
      } else {
        const t:any = await api.createWorkspaceTask(workspaceId, 'Untitled Task', null, statusId || undefined);
        setTasks(prev=>[t, ...prev]);
        setAssigneesByTask(prev=>({ ...prev, [t.id]: [] }));
        setTagsByTask(prev=>({ ...prev, [t.id]: [] }));
        setOpenTask(t);
      }
    } catch {}
  };

  const onDrop = async (taskId: string, toStatusId: string | null) => {
    const t = tasks.find(x=>x.id===taskId);
    if (!t) return;
    try {
      let body: any = { status_id: toStatusId };
      if (toStatusId && statusIdToProjectId[toStatusId]) {
        // Move across projects if target status belongs to a different project
        const destProjectId = statusIdToProjectId[toStatusId];
        if (destProjectId !== (t.project_id || null)) body.project_id = destProjectId;
      } else if (!toStatusId && t.project_id) {
        // Dropping into "No Status" does not imply leaving the project; keep project as is
      } else if (toStatusId && toStatusId.startsWith('default:')) {
        // Default status → project-less task
        if (t.project_id) body.project_id = null;
      }
      const updated:any = await api.updateTask(taskId, body);
      setTasks(prev=>prev.map(x=>x.id===taskId? updated: x));
    } catch {}
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-md">All Tasks</div>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
        <button
          className={`button w-8 h-8 p-0 flex items-center justify-center ${!workspaceId ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => { if (workspaceId) createNew(); }}
          title={workspaceId ? "New task" : "Preparing workspace…"}
          disabled={!workspaceId}
        >
          +
        </button>
      </div>
      <TagFilter
        tags={workspaceTags as any}
        selected={selectedTags}
        onToggle={(id)=> setSelectedTags(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])}
        onClear={()=> setSelectedTags([])}
      />

      {viewMode === 'list' ? (
        <TaskList
          tasks={filteredTasks}
          projectsById={projectsById}
          statusesById={statuses}
          assigneesByTask={assigneesByTask}
          tagsByTask={tagsByTask}
          onToggleCompleted={(t,next)=>toggle(t,next)}
          onOpen={(t)=>setOpenTask(t)}
          onNew={createNew}
          newDisabled={!workspaceId}
        />
      ) : (
        <TaskBoard
          tasks={filteredTasks}
          projectsById={projectsById}
          statusesById={statuses}
          statusOrder={['default:backlog','default:in_progress','default:blocked','default:done']}
          assigneesByTask={assigneesByTask}
          tagsByTask={tagsByTask}
          newDisabled={!workspaceId}
          onCreateInStatus={createInStatus}
          onDrop={onDrop}
          onToggleCompleted={(t,next)=>toggle(t,next)}
          onOpen={(t)=>setOpenTask(t)}
        />
      )}
      {openTask && (
        <TaskDetail
          task={openTask}
          project={projectsById[openTask.project_id || '']}
          status={openTask.status_id ? statuses[openTask.status_id] : undefined}
          onClose={()=>setOpenTask(null)}
          onChange={(u)=>{ setTasks(prev=>prev.map(x=>x.id===u.id? (u as any): x)); setOpenTask(u as any); }}
          onTagsChanged={(taskId, tagList)=> setTagsByTask(prev=>({ ...prev, [taskId]: tagList }))}
          onAssigneesChanged={(taskId, users)=> setAssigneesByTask(prev=>({ ...prev, [taskId]: users }))}
          onDelete={(id)=>{ setTasks(prev => prev.filter(t => t.id !== id)); setAssigneesByTask(prev=>{ const { [id]:_, ...rest } = prev; return rest; }); setOpenTask(null); }}
          projects={projects as any}
          statusesById={statuses}
          statusesByProject={statusesByProject}
        />
      )}
    </div>
  );
}
