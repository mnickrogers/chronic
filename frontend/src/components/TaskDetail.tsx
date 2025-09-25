"use client";
import { useEffect, useRef, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import type { Task, Project, Status } from "./TaskList";
import { DEFAULT_STATUSES } from "@/lib/default-statuses";
import UserPicker from "@/components/UserPicker";
import UserBadge from "@/components/UserBadge";
import { useCurrentWorkspace } from "@/components/AppShell";
import TagPicker from "@/components/TagPicker";
import TagBadge from "@/components/TagBadge";
import { useKeyboard } from "@/lib/keyboard/KeyboardProvider";
import { useRouter } from "next/navigation";

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
  const kb = useKeyboard();
  const router = useRouter();

  // Keyboard focus targets inside the modal
  const assignBtnRef = useRef<HTMLButtonElement | null>(null);
  const addTagBtnRef = useRef<HTMLButtonElement | null>(null);
  const dueRef = useRef<HTMLInputElement | null>(null);
  const projectRef = useRef<HTMLSelectElement | null>(null);
  const statusRef = useRef<HTMLSelectElement | null>(null);
  // Start un-highlighted
  const [detailActiveIndex, setDetailActiveIndex] = useState<number>(-1);

  // Move focus when index changes
  useEffect(() => {
    const targets = [assignBtnRef.current, addTagBtnRef.current, dueRef.current, projectRef.current, statusRef.current];
    const el = detailActiveIndex >= 0 ? targets[detailActiveIndex] : null;
    if (el) { try { (el as any).focus(); } catch {} }
  }, [detailActiveIndex]);

  const openNativeSelect = (el: HTMLSelectElement | null) => {
    if (!el) return;
    el.focus();
    try { (el as any)?.showPicker?.(); } catch {}
    try {
      const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
      el.dispatchEvent(down);
      const up = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
      el.dispatchEvent(up);
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      el.dispatchEvent(click);
    } catch {}
  };

  // High-priority scope for modal keyboard
  useEffect(() => {
    const reg = kb.registerScope((evt) => {
      const { input } = evt;
      if (input.key === 'Escape') {
        if (pickerOpen) { setPickerOpen(false); return true; }
        if (tagPickerOpen) { setTagPickerOpen(false); return true; }
        onClose();
        return true;
      }
      if (!input.ctrlKey && !input.metaKey && !input.altKey) {
        const gridCols = 2;
        const posFor = (idx:number) => ({ col: idx % gridCols, row: Math.floor(idx / gridCols) });
        const idxFor = (col:number,row:number) => {
          const idx = row * gridCols + col;
          // valid items: 0..4 excluding col=1,row=2
          if (idx === 5) return -1;
          return idx;
        };
        const ensureActive = () => { if (detailActiveIndex < 0) { setDetailActiveIndex(0); return true; } return false; };
        if (input.key === 'h' || input.key === 'ArrowLeft') { if (ensureActive()) return true; const p = posFor(detailActiveIndex); const n = idxFor(Math.max(0, p.col-1), p.row); if (n>=0) setDetailActiveIndex(n); return true; }
        if (input.key === 'l' || input.key === 'ArrowRight') { if (ensureActive()) return true; const p = posFor(detailActiveIndex); const n = idxFor(Math.min(1, p.col+1), p.row); if (n>=0) setDetailActiveIndex(n); return true; }
        if (input.key === 'j' || input.key === 'ArrowDown') { if (ensureActive()) return true; const p = posFor(detailActiveIndex); const n = idxFor(p.col, p.row+1); if (n>=0) setDetailActiveIndex(n); return true; }
        if (input.key === 'k' || input.key === 'ArrowUp') { if (ensureActive()) return true; const p = posFor(detailActiveIndex); const n = idxFor(p.col, Math.max(0, p.row-1)); if (n>=0) setDetailActiveIndex(n); return true; }
        if (input.key === 'Enter' || input.key === 'o') {
          if (ensureActive()) return true;
          const idx = detailActiveIndex < 0 ? 0 : detailActiveIndex;
          if (idx === 0) { evt.stopPropagation(); setPickerOpen(true); assignBtnRef.current?.focus(); return true; }
          if (idx === 1) { evt.stopPropagation(); setTagPickerOpen(true); addTagBtnRef.current?.focus(); return true; }
          if (idx === 2) { evt.stopPropagation(); dueRef.current?.focus(); (dueRef.current as any)?.showPicker?.(); return true; }
          if (idx === 3) {
            evt.stopPropagation();
            if (input.key === 'o' || !task.project_id) { openNativeSelect(projectRef.current); return true; }
            router.push(`/projects/${task.project_id}`);
            return true;
          }
          if (idx === 4) {
            if (input.key === 'o') { openNativeSelect(statusRef.current); evt.stopPropagation(); return true; }
            statusRef.current?.focus();
            evt.stopPropagation();
            return false;
          }
        }
      }
      return false;
    }, { priority: 10, active: true });
    return () => reg.unregister();
  }, [kb, detailActiveIndex, pickerOpen, tagPickerOpen, onClose, task.project_id, router]);

  // Allow Escape to close while typing in inputs/selects
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (pickerOpen) { setPickerOpen(false); return; } if (tagPickerOpen) { setTagPickerOpen(false); return; } onClose(); }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
  }, [pickerOpen, tagPickerOpen, onClose]);

  useEffect(() => { setTitle(task.name); setDue(task.due_date || ''); setDetailActiveIndex(-1); setPickerOpen(false); setTagPickerOpen(false); }, [task.id]);
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
              <div className="relative" data-kb-active={detailActiveIndex===0 ? 'true' : undefined}>
                <button ref={assignBtnRef} className="button" onClick={()=>setPickerOpen(v=>!v)}>Assign</button>
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
              <div className="relative" data-kb-active={detailActiveIndex===1 ? 'true' : undefined}>
                <button ref={addTagBtnRef} className="button" onClick={()=>setTagPickerOpen(v=>!v)}>Add Tag</button>
                {tagPickerOpen && (
                  <div className="absolute z-10 mt-1 w-80" onClick={(e)=>e.stopPropagation()}>
                    <TagPicker
                      onSelect={async (tag)=>{ try { await api.addTaskTag(task.id, tag.id); const ts = await api.listTaskTags(task.id); setTags(ts as any[]); onTagsChanged?.(task.id, ts as any[]); } catch {} setTagPickerOpen(false); }}
                      onClose={()=>setTagPickerOpen(false)}
                    />
                  </div>
                )}
              </div>
            </div>
          </Meta>
          <Meta label="Due">
            <div data-kb-active={detailActiveIndex===2 ? 'true' : undefined}>
              <input ref={dueRef} type="date" className="input w-full" value={due} onChange={e=>setDue(e.target.value)} onBlur={saveMeta} />
            </div>
          </Meta>
          <Meta label="Project">
            <div data-kb-active={detailActiveIndex===3 ? 'true' : undefined}>
              <select ref={projectRef} className="input w-full" value={task.project_id || ''} onChange={(e)=>moveProject(e.target.value || null as any)}>
                <option value="">[none]</option>
                {(projects||[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </Meta>
          <Meta label="Status">
            <div data-kb-active={detailActiveIndex===4 ? 'true' : undefined}>
              <select
                ref={statusRef}
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
            </div>
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
