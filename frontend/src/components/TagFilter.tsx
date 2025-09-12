"use client";
import TagBadge from "@/components/TagBadge";

export type Tag = { id: string; name: string; color?: string | null };

export default function TagFilter({ tags, selected, onToggle, onClear }:{ tags: Tag[]; selected: string[]; onToggle: (id: string)=>void; onClear: ()=>void }){
  return (
    <div className="frame p-2 bg-[#2B2B31] mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm opacity-80">Filter by tag</div>
        <button className={`text-xs ${selected.length? 'opacity-100':'opacity-50 cursor-not-allowed'}`} disabled={!selected.length} onClick={onClear}>Clear</button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {tags.length === 0 && <div className="text-sm opacity-70">No tags</div>}
        {tags.map(t => (
          <button key={t.id} className={`rounded-sm px-0 py-0.5 ${selected.includes(t.id)? 'ring-2 ring-[var(--accent)]':''}`} onClick={()=>onToggle(t.id)}>
            <TagBadge name={t.name} color={t.color} borderless />
          </button>
        ))}
      </div>
    </div>
  );
}
