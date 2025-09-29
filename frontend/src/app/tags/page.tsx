"use client";
import { useEffect, useRef, useState } from "react";
import AppShell, { useCurrentWorkspace } from "@/components/AppShell";
import { api } from "@/lib/api";
import TagBadge from "@/components/TagBadge";
import { useListNav } from "@/lib/keyboard/useListNav";

export default function TagsPage() {
  return (
    <AppShell>
      <TagsInner />
    </AppShell>
  );
}

function TagsInner() {
  const { workspaceId } = useCurrentWorkspace();
  const [tags, setTags] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6B7280');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6B7280');
  const [error, setError] = useState<string | null>(null);
  const createRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (!workspaceId) return; api.listTags(workspaceId).then(setTags).catch(()=>{}); }, [workspaceId]);

  const create = async () => {
    if (!workspaceId || !name.trim()) return;
    try { setError(null); const t:any = await api.createTag(workspaceId, name.trim(), color); setTags(prev=>[...prev, t]); setName(''); setColor('#6B7280'); setCreating(false); }
    catch (e:any) { setError(e?.message || 'Failed to create tag'); }
  };

  const saveEdit = async (id: string) => {
    try { setError(null); const t:any = await api.updateTag(id, { name: editName, color: editColor }); setTags(prev=>prev.map(x=>x.id===id? t: x)); setEditingId(null); }
    catch (e:any) { setError(e?.message || 'Failed to update tag'); }
  };

  const remove = async (id: string) => {
    try { setError(null); await api.deleteTag(id); setTags(prev=>prev.filter(x=>x.id!==id)); } catch (e:any) { setError(e?.message || 'Failed to delete tag'); }
  };

  const listNav = useListNav(tags.length, {
    onOpen: (i) => {
      const t = tags[i]; if (!t) return;
      setEditingId(t.id);
      setEditName(t.name);
      setEditColor(t.color || '#6B7280');
    },
    onNew: () => { setCreating(true); setTimeout(()=>createRef.current?.focus(), 0); },
  });

  useEffect(() => {
    if (!creating && !editingId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (editingId) { setEditingId(null); return; }
      setCreating(false);
      setName('');
      setColor('#6B7280');
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true } as any);
  }, [creating, editingId]);

  return (
    <div>
      <div className="mb-3 text-md">Tags</div>
      {error && <div className="mb-2 text-sm text-red-400">{error}</div>}
      <div className="frame bg-[var(--bg-2)] p-3" {...listNav.getContainerProps()}>
        <div className="space-y-2">
          {tags.length === 0 && <div className="text-sm opacity-70">No tags yet</div>}
          {tags.map((t, i) => (
            <div key={t.id} className="flex items-center gap-2" {...listNav.getItemProps(i)}>
              {editingId === t.id ? (
                <>
                  <input
                    className="input flex-1"
                    value={editName}
                    onChange={e=>setEditName(e.target.value)}
                    onKeyDown={(e)=>{
                      if(e.key==='Escape'){ e.stopPropagation(); setEditingId(null); }
                      if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); saveEdit(t.id); }
                    }}
                  />
                  <input
                    type="color"
                    className="w-8 h-8 p-0"
                    value={editColor}
                    onChange={e=>setEditColor(e.target.value)}
                    onKeyDown={(e)=>{ if(e.key==='Escape'){ e.stopPropagation(); setEditingId(null); } }}
                  />
                  <button className="button" onClick={()=>saveEdit(t.id)}>Save</button>
                  <button className="button" onClick={()=>setEditingId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <TagBadge name={t.name} color={t.color} />
                  <div className="flex-1"></div>
                  <button className="text-xs opacity-70 hover:opacity-100" onClick={()=>{ setEditingId(t.id); setEditName(t.name); setEditColor(t.color || '#6B7280'); }}>Edit</button>
                  <button className="text-xs opacity-70 hover:opacity-100 text-red-400" onClick={()=>remove(t.id)}>Delete</button>
                </>
              )}
            </div>
          ))}
          {creating ? (
            <div className="flex items-center gap-2">
              <input
                ref={createRef}
                className="input flex-1"
                placeholder="New tag name"
                value={name}
                onChange={e=>setName(e.target.value)}
                onKeyDown={(e)=>{
                  if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); create(); }
                  if(e.key==='Escape'){ e.stopPropagation(); setCreating(false); setName(''); setColor('#6B7280'); }
                }}
              />
              <input
                type="color"
                className="w-8 h-8 p-0"
                value={color}
                onChange={e=>setColor(e.target.value)}
                onKeyDown={(e)=>{ if(e.key==='Escape'){ e.stopPropagation(); setCreating(false); setName(''); setColor('#6B7280'); } }}
              />
              <button className="button" onClick={create}>Add</button>
              <button className="button" onClick={()=>{ setCreating(false); setName(''); setColor('#6B7280'); }}>Cancel</button>
            </div>
          ) : (
            <button className="button" onClick={()=>setCreating(true)}>New Tag</button>
          )}
        </div>
      </div>
    </div>
  );
}
