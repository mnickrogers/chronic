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
  const [openTask, setOpenTask] = useState<Task | null>(null);

  // Load projects and all tasks in the current workspace
  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      try {
        const prjs = await api.listProjects(workspaceId);
        setProjects(prjs);
        // Load tasks for each project
        const taskGroups = await Promise.all(prjs.map((p:any) => api.listTasks(p.id)));
        setTasks(taskGroups.flat());
        // Load statuses for each project and flatten
        const statusGroups = await Promise.all(prjs.map((p:any) => api.getStatuses(p.id)));
        const map: Record<string, Status> = {};
        statusGroups.flat().forEach((s:any)=>{ map[s.id] = s; });
        setStatuses(map);
      } catch {}
    })();
  }, [workspaceId]);

  const projectsById = useMemo(() => Object.fromEntries(projects.map((p:any)=>[p.id, p])), [projects]);

  const toggle = async (t: Task, next: boolean) => {
    const updated = await api.updateTask(t.id, { is_completed: next });
    setTasks(prev=>prev.map(x=>x.id===t.id? (updated as any): x));
  };

  return (
    <div>
      <div className="mb-3 text-md">All Tasks</div>
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
          project={projectsById[openTask.project_id]}
          status={openTask.status_id ? statuses[openTask.status_id] : undefined}
          onClose={()=>setOpenTask(null)}
          onChange={(u)=>{ setTasks(prev=>prev.map(x=>x.id===u.id? (u as any): x)); setOpenTask(u as any); }}
        />
      )}
    </div>
  );
}

