"use client";
import { useMemo } from "react";
import { api } from "@/lib/api";

export type Task = {
  id: string;
  name: string;
  project_id: string | null;
  status_id?: string | null;
  priority: number;
  is_completed: boolean;
  due_date?: string | null; // ISO date
};

export type Project = { id: string; name: string };
export type Status = { id: string; label: string; is_done: boolean };
export type User = { id: string; email: string; display_name: string };

export type TaskListProps = {
  tasks: Task[];
  projectsById?: Record<string, Project>;
  statusesById?: Record<string, Status>;
  assigneesByTask?: Record<string, User[]>;
  onToggleCompleted?: (task: Task, next: boolean) => void;
  onOpen?: (task: Task) => void;
  onNew?: () => void;
  newDisabled?: boolean;
};

export default function TaskList({ tasks, projectsById={}, statusesById={}, assigneesByTask={}, onToggleCompleted, onOpen, onNew, newDisabled }: TaskListProps) {
  const grouped = useMemo(() => groupByDue(tasks), [tasks]);
  const sections = ["Today", "This Week", "This Month", "Later", "No Date"] as const;
  return (
    <div className="frame bg-[#2B2B31] relative">
      {onNew && (
        <button
          title="New task"
          className={`button absolute right-2 top-2 w-8 h-8 p-0 flex items-center justify-center ${newDisabled? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => { if(!newDisabled) onNew(); }}
        >
          +
        </button>
      )}
      {sections.map((sec, idx) => (
        <div key={sec} className={idx>0?"border-t border-[#3A3A45]":undefined}>
          <div className="px-3 py-2 text-sm opacity-80 border-b border-[#3A3A45]">{sec}</div>
          {grouped[sec].length === 0 ? (
            <div className="px-4 py-3 text-sm opacity-60">No tasks</div>
          ) : (
            grouped[sec].map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                project={projectsById[t.project_id || '']}
                status={t.status_id ? statusesById[t.status_id] : undefined}
                assignees={assigneesByTask?.[t.id] || []}
                onToggleCompleted={(n)=>onToggleCompleted?.(t, n)}
                onOpen={()=>onOpen?.(t)}
              />
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function TaskRow({ task, project, status, assignees, onToggleCompleted, onOpen }:{ task: Task, project?: Project, status?: Status, assignees?: User[], onToggleCompleted?: (next:boolean)=>void, onOpen?: ()=>void }){
  return (
    <div className="flex items-center gap-1 pl-3 pr-1 py-2 border-b border-[#3A3A45] last:border-b-0 cursor-pointer hover:bg-[#222227]" onClick={onOpen}>
      <div className="w-5 h-5 border border-[var(--stroke)] rounded-sm flex items-center justify-center" onClick={(e)=>{ e.stopPropagation(); onToggleCompleted?.(!task.is_completed); }}>
        {task.is_completed ? <div className="w-3 h-3 bg-[var(--stroke)]"/> : null}
      </div>
      <div className="flex-1 text-sm">
        <div className={`${task.is_completed? 'line-through opacity-60': ''}`}>{task.name}</div>
      </div>
      <div className="text-xs opacity-70 w-[110px] text-right tabular-nums">
        {formatDueLabel(task.due_date)}
      </div>
      <div className="text-xs opacity-80 w-[120px] text-right truncate">
        {assignees && assignees.length > 0 ? assignees.map(handleFor).join(' ') : ''}
      </div>
      <div className="text-xs opacity-70 w-[100px] text-right truncate">
        {project?.name ? `#${project.name}` : ''}
      </div>
    </div>
  );
}

type GroupKey = "Today" | "This Week" | "This Month" | "Later" | "No Date";

function groupByDue(tasks: Task[]): Record<GroupKey, Task[]> {
  const out: Record<GroupKey, Task[]> = { "Today": [], "This Week": [], "This Month": [], "Later": [], "No Date": [] };
  const now = new Date();
  for (const t of tasks) {
    if (!t.due_date) { out["No Date"].push(t); continue; }
    const d = new Date(t.due_date + 'T00:00:00');
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) { out["Today"].push(t); continue; }
    const day = d.getDay();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - ((now.getDay()+6)%7)); // Monday
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate()+6);
    if (d >= startOfWeek && d <= endOfWeek) { out["This Week"].push(t); continue; }
    const sameMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (sameMonth) { out["This Month"].push(t); continue; }
    out["Later"].push(t);
  }
  return out;
}

export function formatDueLabel(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  const now = new Date();
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return "Today";
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1);
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  // Same week → weekday name
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - ((now.getDay()+6)%7));
  const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate()+6);
  if (d >= startOfWeek && d <= endOfWeek) return dayNames[d.getDay()];
  // Otherwise short date
  return `${dayNames[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}`;
}

function handleFor(u: User) {
  const local = (u.email || '').split('@')[0] || u.display_name.replace(/\s+/g,'').toLowerCase();
  return `@${local}`;
}
