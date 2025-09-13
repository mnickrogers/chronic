"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useCurrentWorkspace } from "@/components/AppShell";

export type Tag = { id: string; name: string; color?: string | null };

export default function TagPicker({ onSelect, onClose }:{ onSelect: (tag: Tag)=>void, onClose?: ()=>void }){
  const { workspaceId } = useCurrentWorkspace();
  const [tags, setTags] = useState<Tag[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6B7280');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6B7280');
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => { if(!workspaceId) return; api.listTags(workspaceId).then(setTags).catch(()=>{}); }, [workspaceId]);

  // Close when clicking outside the picker
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: MouseEvent) => {
      if (!rootEl) return;
      const target = e.target as Node;
      if (!rootEl.contains(target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [rootEl, onClose]);

  const create = async () => {
    if (!workspaceId || !name.trim()) return;
    try { const t:any = await api.createTag(workspaceId, name.trim(), color); setTags(prev=>[...prev, t]); setName(''); setColor('#6B7280'); setCreating(false); }
    catch {}
  };

  const saveEdit = async (id: string) => {
    try { const t:any = await api.updateTag(id, { name: editName, color: editColor }); setTags(prev=>prev.map(x=>x.id===id? t: x)); setEditingId(null); }
    catch {}
  };

  const remove = async (id: string) => {
    try { await api.deleteTag(id); setTags(prev=>prev.filter(x=>x.id!==id)); } catch {}
  };

  return (
    <div ref={setRootEl} className="frame p-2 bg-[var(--bg-2)] border border-[var(--stroke)] rounded-sm">
      {/* Existing tags */}
      <div className="max-h-60 overflow-auto divide-y divide-[#3A3A45]">
        {tags.map(t => (
          <div key={t.id} className="flex items-center gap-2 p-2 hover:bg-[var(--bg-1)]">
            {editingId === t.id ? (
              <>
                <input className="input flex-1" value={editName} onChange={e=>setEditName(e.target.value)} />
                <input type="color" className="w-8 h-8 p-0" value={editColor} onChange={e=>setEditColor(e.target.value)} />
                <button className="button" onClick={()=>saveEdit(t.id)}>Save</button>
                <button className="button" onClick={()=>setEditingId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span className="inline-block w-4 h-4 rounded-sm border border-[var(--stroke)]" style={{ backgroundColor: t.color || '#6B7280' }} />
                <button className="text-left flex-1" onClick={()=>onSelect(t)}>{t.name}</button>
                <button className="text-xs opacity-70 hover:opacity-100" title="Edit" onClick={()=>{ setEditingId(t.id); setEditName(t.name); setEditColor(t.color || '#6B7280'); }}>✎</button>
                <button className="text-xs opacity-70 hover:opacity-100 text-red-400" title="Delete" onClick={()=>remove(t.id)}>🗑</button>
              </>
            )}
          </div>
        ))}
        {tags.length === 0 && (
          <div className="p-2 text-sm opacity-70">No tags yet</div>
        )}
      </div>

      {/* Create new */}
      {creating ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="New tag name"
            value={name}
            onChange={e=>setName(e.target.value)}
            onKeyDown={(e)=>{ if(e.key==='Enter') create(); }}
          />
          <input type="color" className="w-8 h-8 p-0" value={color} onChange={e=>setColor(e.target.value)} />
        </div>
      ) : (
        <div className="mt-2">
          <button className="button" onClick={()=>setCreating(true)}>New Tag</button>
        </div>
      )}
    </div>
  );
}
