"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell, { useCurrentWorkspace } from "@/components/AppShell";
import TaskList, { Task, Project, Status } from "@/components/TaskList";
import TaskDetail from "@/components/TaskDetail";
import { api } from "@/lib/api";
import { DEFAULT_STATUSES } from "@/lib/default-statuses";

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
          const entries = await Promise.all((all as any[]).map(async (t:any)=> [t.id, await api.listTaskAssignees(t.id)]));
          setAssigneesByTask(Object.fromEntries(entries));
        } catch {}
      } catch {}
    })();
  }, [workspaceId]);

  const projectsById = useMemo(() => Object.fromEntries(projects.map((p:any)=>[p.id, p])), [projects]);

  const toggle = async (t: Task, next: boolean) => {
    const updated = await api.updateTask(t.id, { is_completed: next });
    setTasks(prev=>prev.map(x=>x.id===t.id? (updated as any): x));
  };

  const createNew = async () => {
    if (!workspaceId) return;
    const t = await api.createWorkspaceTask(workspaceId, 'Untitled Task', null, DEFAULT_STATUSES[0].id);
    setTasks(prev=>[t as any, ...prev]);
    setAssigneesByTask(prev=>({ ...prev, [(t as any).id]: [] }));
    setOpenTask(t as any);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-md">All Tasks</div>
        <button
          className={`button w-8 h-8 p-0 flex items-center justify-center ${!workspaceId ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => { if (workspaceId) createNew(); }}
          title={workspaceId ? "New task" : "Preparing workspace…"}
          disabled={!workspaceId}
        >
          +
        </button>
      </div>
      <TaskList
        tasks={tasks}
        projectsById={projectsById}
        statusesById={statuses}
        assigneesByTask={assigneesByTask}
        onToggleCompleted={(t,next)=>toggle(t,next)}
        onOpen={(t)=>setOpenTask(t)}
        onNew={createNew}
        newDisabled={!workspaceId}
      />
      {openTask && (
        <TaskDetail
          task={openTask}
          project={projectsById[openTask.project_id || '']}
          status={openTask.status_id ? statuses[openTask.status_id] : undefined}
          onClose={()=>setOpenTask(null)}
          onChange={(u)=>{ setTasks(prev=>prev.map(x=>x.id===u.id? (u as any): x)); setOpenTask(u as any); }}
          onAssigneesChanged={(taskId, users)=> setAssigneesByTask(prev=>({ ...prev, [taskId]: users }))}
          projects={projects as any}
          statusesById={statuses}
          statusesByProject={statusesByProject}
        />
      )}
    </div>
  );
}
