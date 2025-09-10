"use client";
import { useEffect, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import type { Task, Project, Status } from "./TaskList";

export default function TaskDetail({ task, project, status, onClose, onChange }:{ task: Task, project?: Project, status?: Status, onClose: ()=>void, onChange?: (t:Task)=>void }){
  const [title, setTitle] = useState(task.name);
  const [due, setDue] = useState<string | ''>(task.due_date || '');
  const [comments, setComments] = useState<any[]>([]);
  const [comment, setComment] = useState('');

  useEffect(() => { setTitle(task.name); setDue(task.due_date || ''); }, [task.id]);
  useEffect(() => { (async () => { try { const res = await fetch(`${API_BASE}/comments/task/${task.id}`, { credentials: 'include' }); if(res.ok) setComments(await res.json()); } catch {} })(); }, [task.id]);

  const saveMeta = async () => {
    try {
      const updated = await api.updateTask(task.id, { name: title, due_date: due || null });
      onChange?.(updated as any);
    } catch {}
  };

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
          <Meta label="Assigned to">—</Meta>
          <Meta label="Due">
            <input type="date" className="input w-full" value={due} onChange={e=>setDue(e.target.value)} onBlur={saveMeta} />
          </Meta>
          <Meta label="Project">{project?.name || '[none]'}</Meta>
          <Meta label="Status">{status?.label || '[none]'}</Meta>
        </div>
        <div className="p-4 max-h-[50vh] overflow-y-auto">
          <div className="text-sm opacity-80 mb-2">Notes</div>
          <div className="space-y-2">
            {comments.map((c:any)=> (
              <div key={c.id} className="frame bg-[#222227] p-2 text-sm">
                {typeof c.body?.text === 'string' ? c.body.text : JSON.stringify(c.body)}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input className="input flex-1" placeholder="Add a note…" value={comment} onChange={e=>setComment(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') addComment(); }} />
            <button className="button" onClick={addComment}>Add</button>
          </div>
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
