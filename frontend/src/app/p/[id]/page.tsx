"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

type Status = { id: string, key: string, label: string, position: number, is_done: boolean };
type Task = { id: string, name: string, status_id?: string, project_id: string, priority: number, is_completed: boolean };

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<'list'|'board'>('list');
  const [newTask, setNewTask] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Fetch data
  useEffect(() => { if (!id) return; api.getStatuses(id).then(setStatuses); api.listTasks(id).then(setTasks); }, [id]);

  // WebSocket subscribe
  useEffect(() => {
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

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(v=>!v); }
      if (e.key === 'l') setView('list');
      if (e.key === 'b') setView('board');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const createTask = async () => {
    if (!newTask) return;
    const def = statuses[0];
    const t = await api.createTask(id, newTask, def?.id);
    setTasks(prev => [t, ...prev]);
    setNewTask('');
  };

  const byStatus = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of statuses) map[s.id] = [];
    for (const t of tasks) map[t.status_id || statuses[0]?.id || 'none']?.push(t);
    return map;
  }, [tasks, statuses]);

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-4">
        <div className="text-lg">Project</div>
        <div className="flex gap-2 text-sm">
          <button className={`button ${view==='list'?'border-[var(--accent)]':''}`} onClick={()=>setView('list')}>List (L)</button>
          <button className={`button ${view==='board'?'border-[var(--accent)]':''}`} onClick={()=>setView('board')}>Board (B)</button>
        </div>
      </header>

      <div className="frame p-3 bg-[#2B2B31] mb-3">
        <div className="flex gap-2 items-center">
          <input className="input flex-1" placeholder="Quick add task..." value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') createTask(); }} />
          <button className="button" onClick={createTask}>Add</button>
          <div className="text-xs opacity-70">Command Palette <span className="kbd">⌘K</span></div>
        </div>
      </div>

      {view === 'list' ? (
        <div className="frame bg-[#2B2B31]">
          {selected.size > 0 && (
            <div className="p-2 border-b border-[#3A3A45] flex items-center gap-2 text-sm">
              <div>{selected.size} selected</div>
              <select className="input" onChange={async (e)=>{
                const sid = e.target.value; if(!sid) return;
                const ids = Array.from(selected);
                for (const idd of ids) { const updated = await api.updateTask(idd, { status_id: sid }); setTasks(prev=>prev.map(x=>x.id===idd?updated:x)); }
                setSelected(new Set());
              }}>
                <option value="">Set status…</option>
                {statuses.map(s=> <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <button className="button" onClick={async ()=>{
                const ids = Array.from(selected);
                for (const idd of ids) { await api.deleteTask(idd); }
                setTasks(prev=>prev.filter(t=>!selected.has(t.id)));
                setSelected(new Set());
              }}>Delete</button>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2 w-8"></th>
                <th className="p-2">Task</th>
                <th className="p-2">Status</th>
                <th className="p-2">Priority</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id} className="border-t border-[#3A3A45]">
                  <td className="p-2"><input type="checkbox" checked={selected.has(t.id)} onChange={(e)=>{
                    const next = new Set(selected); if (e.target.checked) next.add(t.id); else next.delete(t.id); setSelected(next);
                  }} /></td>
                  <td className="p-2">{t.name}</td>
                  <td className="p-2">
                    <select className="input" value={t.status_id || ''} onChange={async (e)=>{
                      const updated = await api.updateTask(t.id, { status_id: e.target.value || null });
                      setTasks(prev=>prev.map(x=>x.id===t.id?updated:x));
                    }}>
                      {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="p-2">P{t.priority}</td>
                  <td className="p-2">
                    <button className="button" onClick={async ()=>{ await api.deleteTask(t.id); setTasks(prev=>prev.filter(x=>x.id!==t.id)); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {statuses.map(s => (
            <div key={s.id} className="frame bg-[#2B2B31] p-2">
              <div className="text-sm mb-2">{s.label}</div>
              <div className="space-y-2">
                {byStatus[s.id]?.map(t => (
                  <div key={t.id} className="frame bg-[#222227] p-2 flex items-center justify-between">
                    <div className="text-sm">{t.name}</div>
                    <button className="button" onClick={async ()=>{ const updated = await api.updateTask(t.id, { status_id: nextStatusId(statuses, s.id) }); setTasks(prev=>prev.map(x=>x.id===t.id?updated:x)); }}>→</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {paletteOpen && <CommandPalette onClose={()=>setPaletteOpen(false)} createTask={(title)=>{ setNewTask(title); setTimeout(createTask, 0); }} />}
    </div>
  );
}

function nextStatusId(statuses: Status[], currentId: string) {
  const idx = statuses.findIndex(s=>s.id===currentId);
  return statuses[(idx+1) % statuses.length]?.id;
}

function CommandPalette({ onClose, createTask }: { onClose: ()=>void, createTask: (t:string)=>void }) {
  const [query, setQuery] = useState('');
  const commands = [
    { id: 'new_task', title: 'New Task…', run: () => { const name = query || 'Untitled Task'; createTask(name); onClose(); } },
    { id: 'switch_list', title: 'Switch to List (L)', run: () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' })); onClose(); } },
    { id: 'switch_board', title: 'Switch to Board (B)', run: () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' })); onClose(); } },
  ];
  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-24" onClick={onClose}>
      <div className="frame bg-[#2B2B31] w-full max-w-lg" onClick={e=>e.stopPropagation()}>
        <input autoFocus className="input w-full border-0 border-b border-[var(--stroke)] rounded-b-none" placeholder="Type a command…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter'){ commands[0].run(); } if(e.key==='Escape') onClose(); }} />
        <div className="p-2">
          {commands.map(cmd => (
            <div key={cmd.id} className="p-2 hover:bg-[#222227] cursor-pointer" onClick={cmd.run}>{cmd.title}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
