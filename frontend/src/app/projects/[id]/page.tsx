"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import AppShell, { useCurrentWorkspace } from "@/components/AppShell";
import TaskList, { Task, Status } from "@/components/TaskList";
import TaskDetail from "@/components/TaskDetail";
import UserPicker from "@/components/UserPicker";
import UserBadge from "@/components/UserBadge";
import { api } from "@/lib/api";

export default function ProjectTasksPage() {
  return (
    <AppShell>
      <ProjectTasksInner />
    </AppShell>
  );
}

function ProjectTasksInner() {
  const { id } = useParams<{ id: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [project, setProject] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { workspaceId } = useCurrentWorkspace();
  const [newTask, setNewTask] = useState('');
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => { if (!id) return; api.listTasks(id).then(setTasks); api.getStatuses(id).then(setStatuses); }, [id]);
  useEffect(() => { if (!id || !workspaceId) return; (async()=>{ try { const prjs = await api.listProjects(workspaceId); setProject(prjs.find((p:any)=>p.id===id) || null); } catch {} })(); }, [id, workspaceId]);
  useEffect(() => { if (!id) return; api.listProjectMembers(id).then((ms:any)=>setMembers(ms.map((m:any)=>m.user))).catch(()=>{}); }, [id]);

  // WebSocket subscribe for live updates
  useEffect(() => {
    if (!id) return;
    const ws = new WebSocket((process.env.NEXT_PUBLIC_WS_BASE || 'ws://localhost:8000') + '/ws');
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ subscribe: `project:${id}` }));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'task.created') setTasks(prev => [msg.task, ...prev]);
      if (msg.type === 'task.updated') setTasks(prev => prev.map(t => t.id === msg.task.id ? msg.task : t));
      if (msg.type === 'task.deleted') setTasks(prev => prev.filter(t => t.id !== msg.id));
    };
    return () => { try { ws.close(); } catch {} };
  }, [id]);

  const statusesById = useMemo(() => Object.fromEntries(statuses.map(s=>[s.id, s])), [statuses]);

  const create = async () => {
    if (!newTask) return;
    const t = await api.createTask(id, newTask, statuses?.[0]?.id);
    setTasks(prev=>[t as any, ...prev]);
    setNewTask('');
  };

  const toggle = async (t: Task, next: boolean) => {
    const updated = await api.updateTask(t.id, { is_completed: next });
    setTasks(prev=>prev.map(x=>x.id===t.id? (updated as any): x));
  };

  const createNew = async () => {
    const t = await api.createTask(id, 'Untitled Task', statuses?.[0]?.id);
    setTasks(prev=>[t as any, ...prev]);
    setOpenTask(t as any);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link href="/projects" className="button">←</Link>
          <div className="text-md">{project?.name || 'Project'}</div>
        </div>
        <button className="button w-8 h-8 p-0 flex items-center justify-center" onClick={createNew} title="New task">+</button>
      </div>

      <div className="frame p-3 bg-[#2B2B31] mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm opacity-80">Project members</div>
          <div className="relative">
            <button className="button" onClick={()=>setPickerOpen(v=>!v)}>Add</button>
            {pickerOpen && workspaceId && (
              <div className="absolute right-0 z-10 mt-1 w-80" onClick={(e)=>e.stopPropagation()}>
                <UserPicker
                  workspaceId={workspaceId}
                  onSelect={async (user)=>{
                    try {
                      // ensure workspace invite (UserPicker may have already invited)
                      await api.addProjectMember(id, user.id);
                      const ms:any = await api.listProjectMembers(id);
                      setMembers(ms.map((m:any)=>m.user));
                    } catch {}
                    setPickerOpen(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {members.length === 0 && <div className="text-sm opacity-70">No members yet</div>}
          {members.map(u => (
            <span key={u.id} className="flex items-center gap-1 bg-[#1F1F23] border border-[var(--stroke)] px-2 py-1 rounded-sm">
              <UserBadge name={u.display_name} email={u.email} />
              <span className="text-xs">{u.display_name}</span>
              <button className="text-xs opacity-70 hover:opacity-100" title="Remove" onClick={async()=>{ try{ await api.removeProjectMember(id, u.id); setMembers(prev=>prev.filter(x=>x.id!==u.id)); }catch{} }}>×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input className="input flex-1" placeholder="Quick add task…" value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') create(); }} />
          <button className="button" onClick={create}>Add</button>
        </div>
      </div>

      <TaskList
        tasks={tasks}
        projectsById={project? { [project.id]: project }: {} as any}
        statusesById={statusesById}
        onToggleCompleted={(t,next)=>toggle(t,next)}
        onOpen={(t)=>setOpenTask(t)}
      />

      {openTask && (
        <TaskDetail
          task={openTask}
          project={project || undefined}
          status={openTask.status_id ? statusesById[openTask.status_id] : undefined}
          onClose={()=>setOpenTask(null)}
          onChange={(u)=>{ setTasks(prev=>prev.map(x=>x.id===u.id? (u as any): x)); setOpenTask(u as any); }}
          projects={project? [project] : []}
          statusesById={statusesById}
          statusesByProject={project? { [project.id]: statuses } : {} as any}
        />
      )}
    </div>
  );
}
