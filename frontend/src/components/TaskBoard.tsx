"use client";
import { useMemo } from "react";
import TagBadge from "@/components/TagBadge";
import { formatDueLabel } from "@/components/TaskList";

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
export type Status = { id: string; label: string; is_done: boolean } & { position?: number };
export type User = { id: string; email: string; display_name: string };
export type Tag = { id: string; name: string; color?: string | null };

export type TaskBoardProps = {
  tasks: Task[];
  projectsById?: Record<string, Project>;
  statusesById?: Record<string, Status>;
  // Optional explicit column order by status id. Unknown/extra statuses are appended.
  statusOrder?: string[];
  assigneesByTask?: Record<string, User[]>;
  tagsByTask?: Record<string, Tag[]>;
  onOpen?: (task: Task) => void;
  onToggleCompleted?: (task: Task, next: boolean) => void;
  onDrop?: (taskId: string, toStatusId: string | null) => void;
  onCreateInStatus?: (statusId: string | null) => void;
  newDisabled?: boolean;
};

export default function TaskBoard({ tasks, projectsById={}, statusesById={}, statusOrder, assigneesByTask={}, tagsByTask={}, onOpen, onToggleCompleted, onDrop, onCreateInStatus, newDisabled }: TaskBoardProps) {
  const { columns, order, unknownId } = useMemo(() => buildColumns(tasks, statusesById, statusOrder), [tasks, statusesById, statusOrder]);
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${order.length}, minmax(220px, 1fr))` }}>
      {order.map((colId) => (
        <div key={colId} className="frame bg-[#2B2B31] flex flex-col max-h-[70vh]"
          onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={(e)=>{
            e.preventDefault();
            try {
              const raw = e.dataTransfer.getData('application/json');
              const data = JSON.parse(raw || '{}');
              if (data && data.taskId && onDrop) onDrop(data.taskId as string, colId === unknownId ? null : colId);
            } catch {}
          }}
        >
          <div className="px-3 py-2 text-sm opacity-80 border-b border-[#3A3A45] sticky top-0 bg-[#2B2B31] z-10 flex items-center justify-between">
            <div>{columns[colId].label}</div>
            <button
              className={`button w-6 h-6 p-0 flex items-center justify-center ${newDisabled? 'opacity-50 cursor-not-allowed':''}`}
              title="New task in this column"
              onClick={()=>{ if (!newDisabled) onCreateInStatus?.(colId === unknownId ? null : colId); }}
              disabled={!!newDisabled}
            >
              +
            </button>
          </div>
          <div className="p-2 overflow-auto space-y-2 min-h-[40px]">
            {columns[colId].tasks.length === 0 ? (
              <div className="text-sm opacity-60 px-1">No tasks</div>
            ) : (
              columns[colId].tasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  project={projectsById[t.project_id || '']}
                  tags={tagsByTask?.[t.id] || []}
                  assignees={assigneesByTask?.[t.id] || []}
                  onOpen={()=>onOpen?.(t)}
                  onToggleCompleted={(n)=>onToggleCompleted?.(t, n)}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildColumns(
  tasks: Task[],
  statusesById: Record<string, Status>,
  statusOrder?: string[],
) {
  const byStatus: Record<string, Task[]> = {};
  const unknownId = "__no_status__";
  for (const t of tasks) {
    const sid = (t.status_id && statusesById[t.status_id]) ? (t.status_id as string) : unknownId;
    byStatus[sid] = byStatus[sid] || [];
    byStatus[sid].push(t);
  }
  const columnLabels: Record<string, string> = { [unknownId]: "No Status" };
  Object.entries(statusesById).forEach(([id, st]) => { columnLabels[id] = st.label; });

  // Determine order: prefer provided, then status positions if available, then alpha, and always keep unknown last
  let order: string[] = [];
  if (statusOrder && statusOrder.length) {
    order = statusOrder.filter((id) => id in byStatus || id in statusesById);
  } else {
    // Try to sort by position if all have it
    const entries = Object.entries(statusesById);
    if (entries.length) {
      order = entries
        .sort((a, b) => (a[1].position ?? 0) - (b[1].position ?? 0))
        .map(([id]) => id);
    }
  }
  // Append any extra statuses not captured yet (e.g., from mixed-project lists)
  for (const sid of Object.keys(byStatus)) {
    if (!order.includes(sid) && sid !== unknownId) order.push(sid);
  }
  // Always add unknown at the end if present
  if (byStatus[unknownId]) order.push(unknownId);

  const columns: Record<string, { label: string; tasks: Task[] }> = {};
  for (const sid of order) {
    columns[sid] = { label: columnLabels[sid] || "", tasks: byStatus[sid] || [] } as any;
  }
  return { columns, order, unknownId } as const;
}

function handleFor(u: User) {
  const local = (u.email || '').split('@')[0] || u.display_name.replace(/\s+/g,'').toLowerCase();
  return `@${local}`;
}

function TaskCard({ task, project, tags, assignees, onOpen, onToggleCompleted }:{ task: Task, project?: Project, tags?: Tag[], assignees?: User[], onOpen?: ()=>void, onToggleCompleted?: (next:boolean)=>void }){
  return (
    <div
      className="border border-[var(--stroke)] bg-[#1F1F23] rounded-sm p-2 cursor-pointer hover:border-[var(--accent)]"
      onClick={onOpen}
      draggable
      onDragStart={(e)=>{
        try { e.dataTransfer.setData('application/json', JSON.stringify({ taskId: task.id, fromStatusId: task.status_id ?? null })); } catch {}
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <div className="flex items-start gap-2">
        <button
          className="w-4 h-4 border border-[var(--stroke)] rounded-sm flex items-center justify-center mt-0.5"
          onClick={(e)=>{ e.stopPropagation(); onToggleCompleted?.(!task.is_completed); }}
          title={task.is_completed?"Mark as not done":"Mark as done"}
        >
          {task.is_completed ? <div className="w-2.5 h-2.5 bg-[var(--stroke)]"/> : null}
        </button>
        <div className="flex-1">
          <div className={`text-sm ${task.is_completed? 'line-through opacity-60': ''}`}>{task.name}</div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {(tags||[]).slice(0,3).map(t => (
              <TagBadge key={t.id} name={t.name} color={t.color} />
            ))}
            {project?.name ? (
              <span className="text-xs opacity-70">#{project.name}</span>
            ) : null}
            {task.due_date ? (
              <span className="text-xs opacity-70 tabular-nums">{formatDueLabel(task.due_date)}</span>
            ) : null}
            {assignees && assignees.length>0 ? (
              <span className="text-xs opacity-80">{assignees.map(handleFor).join(' ')}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
