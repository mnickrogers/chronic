"use client";
import { useEffect, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import type { Task, Project, Status } from "./TaskList";
import { DEFAULT_STATUSES } from "@/lib/default-statuses";
import UserPicker from "@/components/UserPicker";
import UserBadge from "@/components/UserBadge";
import { useCurrentWorkspace } from "@/components/AppShell";

export default function TaskDetail({ task, project, status, onClose, onChange, onAssigneesChanged, projects, statusesById, statusesByProject }:{ task: Task, project?: Project, status?: Status, onClose: ()=>void, onChange?: (t:Task)=>void, onAssigneesChanged?: (taskId: string, users: any[]) => void, projects?: Project[], statusesById?: Record<string, Status>, statusesByProject?: Record<string, Status[]> }){
  const [title, setTitle] = useState(task.name);
  const [due, setDue] = useState<string | ''>(task.due_date || '');
  const [comments, setComments] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [desc, setDesc] = useState<string>(typeof (task as any).description?.text === 'string' ? (task as any).description.text : '');
  const [assignees, setAssignees] = useState<any[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { workspaceId } = useCurrentWorkspace();

  useEffect(() => { setTitle(task.name); setDue(task.due_date || ''); }, [task.id]);
  useEffect(() => { (async () => { try { const res = await fetch(`${API_BASE}/comments/task/${task.id}`, { credentials: 'include' }); if(res.ok) setComments(await res.json()); } catch {} })(); }, [task.id]);
  useEffect(() => { (async () => { try { const users = await api.listTaskAssignees(task.id); setAssignees(users as any[]); onAssigneesChanged?.(task.id, users as any[]); } catch {} })(); }, [task.id]);

  const saveMeta = async () => {
    try {
      const updated = await api.updateTask(task.id, { name: title, due_date: due || null });
      onChange?.(updated as any);
    } catch {}
  };

  const moveProject = async (projectId: string | null) => {
    try {
      const updated = await api.updateTask(task.id, { project_id: projectId });
      onChange?.(updated as any);
    } catch {}
  };

  const saveDescription = async () => {
    try {
      const body = { description: { type: 'plain', text: desc } };
      const updated = await api.updateTask(task.id, body);
      onChange?.(updated as any);
    } catch {}
  }

  const addComment = async () => {
    if (!comment.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/comments/task/${task.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ body: { type: 'text', text: comment } }) });
      if (res.ok) { const c = await res.json(); setComments([...comments, c]); setComment(''); }
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20" onClick={onClose}>
      <div className="frame bg-[#2B2B31] w-full max-w-3xl" onClick={(e)=>e.stopPropagation()}>
        <div className="p-4 border-b border-[#3A3A45]">
          <input className="bg-transparent outline-none w-full text-xl" value={title} onChange={e=>setTitle(e.target.value)} onBlur={saveMeta} />
        </div>
        <div className="p-4 border-b border-[#3A3A45] grid grid-cols-2 gap-4 text-sm">
          <Meta label="Assigned to">
            <div className="flex items-center gap-2 flex-wrap">
              {assignees.length === 0 && <span className="opacity-70">—</span>}
              {assignees.map(u => (
                <span key={u.id} className="flex items-center gap-1 bg-[#1F1F23] border border-[var(--stroke)] px-2 py-1 rounded-sm">
                  <UserBadge name={u.display_name} email={u.email} />
                  <span className="text-xs">{u.display_name}</span>
                  <button
                    className="text-xs opacity-70 hover:opacity-100"
                    onClick={async (e)=>{ e.stopPropagation(); try{ await api.removeTaskAssignee(task.id, u.id); const next = assignees.filter(x=>x.id!==u.id); setAssignees(next); onAssigneesChanged?.(task.id, next); }catch{} }}
                    title="Remove"
                  >×</button>
                </span>
              ))}
              <div className="relative">
                <button className="button" onClick={()=>setPickerOpen(v=>!v)}>Assign</button>
                {pickerOpen && workspaceId && (
                  <div className="absolute z-10 mt-1 w-80" onClick={(e)=>e.stopPropagation()}>
                    <UserPicker
                      workspaceId={workspaceId}
                      onSelect={async (user)=>{
                        try { await api.addTaskAssignee(task.id, user.id); const users = await api.listTaskAssignees(task.id); setAssignees(users as any[]); onAssigneesChanged?.(task.id, users as any[]); } catch {}
                        setPickerOpen(false);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </Meta>
          <Meta label="Due">
            <input type="date" className="input w-full" value={due} onChange={e=>setDue(e.target.value)} onBlur={saveMeta} />
          </Meta>
          <Meta label="Project">
            <select className="input w-full" value={task.project_id || ''} onChange={(e)=>moveProject(e.target.value || null as any)}>
              <option value="">[none]</option>
              {(projects||[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Meta>
          <Meta label="Status">
            <select
              className="input w-full"
              value={task.status_id || ''}
              onChange={async (e)=>{
                const val = e.target.value || null;
                const updated = await api.updateTask(task.id, { status_id: val });
                onChange?.(updated as any);
              }}
            >
              <option value="">— No status —</option>
              {(task.project_id ? (statusesByProject?.[task.project_id] || []) : DEFAULT_STATUSES as any).map((s: any) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </Meta>
        </div>
        <div className="p-0">
          <div className="border-t border-[var(--stroke)]"></div>
          <textarea
            className="w-full min-h-[40vh] bg-[#2B2B31] p-4 outline-none"
            placeholder="Write a description…"
            value={desc}
            onChange={e=>setDesc(e.target.value)}
            onBlur={saveDescription}
            onKeyDown={(e)=>{ if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='enter'){ e.preventDefault(); saveDescription(); } }}
          />
        </div>
      </div>
    </div>
  );
}

function Meta({ label, children }:{ label: string, children?: React.ReactNode }) {
  return (
    <div>
      <div className="opacity-70 mb-1">{label}:</div>
      <div>{children}</div>
    </div>
  );
}
