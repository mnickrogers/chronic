"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell, { useCurrentWorkspace } from "@/components/AppShell";
import TaskList, { Task, Project, Status } from "@/components/TaskList";
import TaskDetail from "@/components/TaskDetail";
import { api } from "@/lib/api";

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

  // Load projects and all tasks in the current workspace
  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      try {
        const prjs = await api.listProjects(workspaceId);
        setProjects(prjs);
        // All tasks in workspace, including those with no project
        const all = await api.listWorkspaceTasks(workspaceId);
        setTasks(all as any);
        // Load statuses for each project and keep both flattened and by-project
        const statusGroups = await Promise.all(prjs.map(async (p:any) => ({ id: p.id, statuses: await api.getStatuses(p.id) })));
        const flat: Record<string, Status> = {};
        const byProject: Record<string, Status[]> = {};
        statusGroups.forEach(({id, statuses}) => { byProject[id] = statuses as any; (statuses as any).forEach((s:any)=>{ flat[s.id] = s; }); });
        setStatuses(flat);
        setStatusesByProject(byProject);
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
    const t = await api.createWorkspaceTask(workspaceId, 'Untitled Task');
    setTasks(prev=>[t as any, ...prev]);
    setOpenTask(t as any);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-md">All Tasks</div>
        <button className={`button w-8 h-8 p-0 flex items-center justify-center`} onClick={createNew} title="New task">+</button>
      </div>
      <TaskList
        tasks={tasks}
        projectsById={projectsById}
        statusesById={statuses}
        onToggleCompleted={(t,next)=>toggle(t,next)}
        onOpen={(t)=>setOpenTask(t)}
      />
      {openTask && (
        <TaskDetail
          task={openTask}
          project={projectsById[openTask.project_id || '']}
          status={openTask.status_id ? statuses[openTask.status_id] : undefined}
          onClose={()=>setOpenTask(null)}
          onChange={(u)=>{ setTasks(prev=>prev.map(x=>x.id===u.id? (u as any): x)); setOpenTask(u as any); }}
          projects={projects as any}
          statusesById={statuses}
          statusesByProject={statusesByProject}
        />
      )}
    </div>
  );
}
