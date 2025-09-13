"use client";
import { TaskViewMode } from "@/lib/view-mode";

export default function ViewToggle({ mode, onChange }: { mode: TaskViewMode, onChange: (m: TaskViewMode)=>void }) {
  return (
    <div className="inline-flex border border-[var(--stroke)] rounded-sm overflow-hidden">
      <button
        className={`px-2 py-1 text-sm ${mode==='list' ? 'bg-[var(--bg-2)]' : 'bg-[var(--bg-1)] hover:bg-[var(--bg-2)]'} border-r border-[var(--stroke)]`}
        aria-pressed={mode==='list'}
        title="List view"
        onClick={()=>onChange('list')}
      >List</button>
      <button
        className={`px-2 py-1 text-sm ${mode==='board' ? 'bg-[var(--bg-2)]' : 'bg-[var(--bg-1)] hover:bg-[var(--bg-2)]'}`}
        aria-pressed={mode==='board'}
        title="Board view"
        onClick={()=>onChange('board')}
      >Board</button>
    </div>
  );
}
