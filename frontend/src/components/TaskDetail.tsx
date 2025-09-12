"use client";
import { useEffect, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import type { Task, Project, Status } from "./TaskList";
import { DEFAULT_STATUSES } from "@/lib/default-statuses";
import UserPicker from "@/components/UserPicker";
import UserBadge from "@/components/UserBadge";
import { useCurrentWorkspace } from "@/components/AppShell";
import TagPicker from "@/components/TagPicker";
import TagBadge from "@/components/TagBadge";

export default function TaskDetail({ task, project, status, onClose, onChange, onAssigneesChanged, onTagsChanged, onDelete, projects, statusesById, statusesByProject }:{ task: Task, project?: Project, status?: Status, onClose: ()=>void, onChange?: (t:Task)=>void, onAssigneesChanged?: (taskId: string, users: any[]) => void, onTagsChanged?: (taskId: string, tags: any[]) => void, onDelete?: (taskId: string) => void, projects?: Project[], statusesById?: Record<string, Status>, statusesByProject?: Record<string, Status[]> }){
  const [title, setTitle] = useState(task.name);
  const [due, setDue] = useState<string | ''>(task.due_date || '');
  const [comments, setComments] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [desc, setDesc] = useState<string>(typeof (task as any).description?.text === 'string' ? (task as any).description.text : '');
  const [assignees, setAssignees] = useState<any[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { workspaceId } = useCurrentWorkspace();
  const [tags, setTags] = useState<any[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  useEffect(() => { setTitle(task.name); setDue(task.due_date || ''); }, [task.id]);
  useEffect(() => { (async () => { try { const res = await fetch(`${API_BASE}/comments/task/${task.id}`, { credentials: 'include' }); if(res.ok) setComments(await res.json()); } catch {} })(); }, [task.id]);
  useEffect(() => { (async () => { try { const users = await api.listTaskAssignees(task.id); setAssignees(users as any[]); onAssigneesChanged?.(task.id, users as any[]); } catch {} })(); }, [task.id]);
  useEffect(() => { (async () => { try { const ts = await api.listTaskTags(task.id); setTags(ts as any[]); onTagsChanged?.(task.id, ts as any[]); } catch {} })(); }, [task.id]);

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
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50" onClick={onClose}>
      <div className="frame bg-[var(--bg-2)] w-full max-w-3xl" onClick={(e)=>{ e.stopPropagation(); if(menuOpen) setMenuOpen(false); }}>
        <div className="p-4 border-b border-[#3A3A45] flex items-center gap-2">
          <input className="bg-transparent outline-none text-xl flex-1" value={title} onChange={e=>setTitle(e.target.value)} onBlur={saveMeta} />
          <div className="relative">
            <button
              className="button w-8 h-8 p-0 flex items-center justify-center"
              onClick={(e)=>{ e.stopPropagation(); setMenuOpen(v=>!v); }}
              title="More options"
            >
              ...
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 z-10 w-44 border border-[var(--stroke)] bg-[var(--bg-2)] rounded-sm shadow">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-[var(--bg-1)] text-red-400"
                  onClick={async (e)=>{
                    e.stopPropagation();
                    setMenuOpen(false);
                    try {
                      if (confirm('Delete this task?')) {
                        await api.deleteTask(task.id);
                        onDelete?.(task.id);
                        onClose();
                      }
                    } catch {}
                  }}
                >
                  Delete Task
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-b border-[#3A3A45] grid grid-cols-2 gap-4 text-sm">
          <Meta label="Assigned to">
            <div className="flex items-center gap-2 flex-wrap">
              {assignees.length === 0 && <span className="opacity-70">—</span>}
              {assignees.map(u => (
                <span key={u.id} className="flex items-center gap-1 bg-[var(--bg-1)] border border-[var(--stroke)] px-2 py-1 rounded-sm">
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
          <Meta label="Tags">
            <div className="flex items-center gap-2 flex-wrap relative" onClick={(e)=>e.stopPropagation()}>
              {tags.length === 0 && <span className="opacity-70">—</span>}
              {tags.map((t:any) => (
                <TagBadge key={t.id} name={t.name} color={t.color} onRemove={async()=>{ try{ await api.removeTaskTag(task.id, t.id); setTags(prev=>{ const next = prev.filter(x=>x.id!==t.id); onTagsChanged?.(task.id, next); return next; }); } catch {} }} />
              ))}
              <div className="relative">
                <button className="button" onClick={()=>setTagPickerOpen(v=>!v)}>Add Tag</button>
                {tagPickerOpen && (
                  <div className="absolute z-10 mt-1 w-80" onClick={(e)=>e.stopPropagation()}>
                    <TagPicker onSelect={async (tag)=>{ try { await api.addTaskTag(task.id, tag.id); const ts = await api.listTaskTags(task.id); setTags(ts as any[]); onTagsChanged?.(task.id, ts as any[]); } catch {} setTagPickerOpen(false); }} />
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
                // If choosing a "done" status, also mark complete
                const isDone = (task.project_id ? (statusesByProject?.[task.project_id] || []) : (DEFAULT_STATUSES as any)).some((s:any)=> s.id === val && s.is_done);
                const body:any = { status_id: val, is_completed: isDone };
                const updated = await api.updateTask(task.id, body);
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
            className="w-full min-h-[40vh] bg-[var(--bg-2)] p-4 outline-none"
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
