"use client";
import { useMemo, useState } from "react";
import TagBadge from "@/components/TagBadge";
import { formatDueLabel } from "@/components/TaskList";
import { useGridNav } from "@/lib/keyboard/useGridNav";

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
  const { columns, order, unknownId, statusForTask } = useMemo(() => buildColumns(tasks, statusesById, statusOrder), [tasks, statusesById, statusOrder]);
  const [dragging, setDragging] = useState<{ taskId: string; fromColId: string } | null>(null);
  const [dragOver, setDragOver] = useState<{ colId: string; targetId?: string; pos: 'before'|'after'|'end' } | null>(null);
  const [orderByCol, setOrderByCol] = useState<Record<string, string[]>>({});

  const tasksById = useMemo(() => Object.fromEntries(tasks.map(t=>[t.id, t])), [tasks]);

  const sortTasksForColumn = (colId: string, items: Task[]) => {
    const manual = orderByCol[colId] || [];
    const manualSet = new Set(manual);
    const manualTasks = manual.map(id => tasksById[id]).filter(Boolean) as Task[];
    const remaining = items.filter(t => !manualSet.has(t.id)).sort((a,b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      const ad = a.due_date ? new Date(a.due_date) : null;
      const bd = b.due_date ? new Date(b.due_date) : null;
      if (ad && bd) return ad.getTime() - bd.getTime();
      if (ad && !bd) return -1;
      if (!ad && bd) return 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.name.localeCompare(b.name);
    });
    return [...manualTasks, ...remaining];
  };

  const moveInState = (taskId: string, fromCol: string, toCol: string, beforeId?: string) => {
    setOrderByCol(prev => {
      const next = { ...prev } as Record<string, string[]>;
      const removeFrom = (col: string) => {
        const arr = next[col];
        if (!arr) return;
        next[col] = arr.filter(id => id !== taskId);
      };
      removeFrom(fromCol);
      if (!next[toCol]) next[toCol] = [];
      const target = next[toCol];
      if (beforeId && target.includes(beforeId)) {
        const idx = target.indexOf(beforeId);
        next[toCol] = [...target.slice(0, idx), taskId, ...target.slice(idx)];
      } else {
        next[toCol] = [...target, taskId];
      }
      return next;
    });
  };
  const gridNav = useGridNav({
    cols: order.length,
    rowsByCol: (ci) => {
      const id = order[ci];
      return id ? sortTasksForColumn(id, columns[id].tasks).length : 0;
    },
  }, {
    onOpen: ({ col, row }) => {
      const id = order[col];
      const items = id ? sortTasksForColumn(id, columns[id].tasks) : [];
      const t = items[row]; if (t) onOpen?.(t);
    },
    onToggle: ({ col, row }) => {
      const id = order[col];
      const items = id ? sortTasksForColumn(id, columns[id].tasks) : [];
      const t = items[row]; if (t) onToggleCompleted?.(t, !t.is_completed);
    },
    onNewInCol: (col) => {
      const id = order[col];
      const dest = id === unknownId ? null : id;
      if (!newDisabled) onCreateInStatus?.(dest);
    },
  });

  return (
    // Wrap the board grid in a horizontal scroll container so that
    // wide boards scroll independently from the whole page. This keeps
    // list views unaffected and prevents body-level horizontal scroll.
    <div className="overflow-x-auto overscroll-x-contain w-full" {...gridNav.getContainerProps()}>
      <div className="grid gap-3 w-max" style={{ gridTemplateColumns: `repeat(${order.length}, minmax(220px, 1fr))` }}>
      {order.map((colId, colIndex) => {
        const items = sortTasksForColumn(colId, columns[colId].tasks);
        const showColActive = dragOver?.colId === colId && dragOver?.pos === 'end';
        return (
        <div key={colId} className={`frame bg-[var(--bg-2)] flex flex-col max-h-[70vh] ${showColActive? 'border-[var(--accent)]': ''}`}
          onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(prev => prev?.colId===colId && prev?.pos==='end' ? prev : { colId, pos: 'end' }); }}
          onDrop={(e)=>{
            e.preventDefault();
            try {
              const raw = e.dataTransfer.getData('application/json');
              const data = JSON.parse(raw || '{}');
              const taskId = data?.taskId as string | undefined;
              if (taskId) {
                const dest = colId === unknownId ? null : colId;
                moveInState(taskId, data.fromColId || statusForTask(taskId) || unknownId, colId);
                onDrop?.(taskId, dest);
              }
            } catch {}
            setDragOver(null);
            setDragging(null);
          }}
        >
          <div className="px-3 py-2 text-sm opacity-80 border-b border-[#3A3A45] sticky top-0 bg-[var(--bg-2)] z-10 flex items-center justify-between">
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
            {items.length === 0 ? (
              <div className="text-sm opacity-60 px-1">No tasks</div>
            ) : (
              items.map((t, idx) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  project={projectsById[t.project_id || '']}
                  tags={tagsByTask?.[t.id] || []}
                  assignees={assigneesByTask?.[t.id] || []}
                  columnId={colId}
                  draggingId={dragging?.taskId}
                  dragOverInfo={dragOver}
                  onDragStart={(task)=> setDragging({ taskId: task.id, fromColId: colId })}
                  onDragOverCard={(targetId, pos)=> setDragOver({ colId, targetId, pos })}
                  onDropOnCard={(targetId, pos)=>{
                    const taskId = dragging?.taskId;
                    if (!taskId) return;
                    let beforeId: string | undefined = undefined;
                    if (pos === 'before') {
                      beforeId = targetId;
                    } else {
                      const i = items.findIndex(x=>x.id===targetId);
                      if (i >= 0 && i+1 < items.length) beforeId = items[i+1].id;
                    }
                    moveInState(taskId, dragging?.fromColId || statusForTask(taskId) || unknownId, colId, beforeId);
                    const dest = colId === unknownId ? null : colId;
                    onDrop?.(taskId, dest);
                    setDragOver(null);
                    setDragging(null);
                  }}
                  onOpen={()=>onOpen?.(t)}
                  onToggleCompleted={(n)=>onToggleCompleted?.(t, n)}
                  extraKBProps={gridNav.getCardProps(colIndex, idx)}
                />
              ))
            )}
          </div>
        </div>
      );})}
      </div>
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
  const statusForTask = (taskId: string) => {
    const t = tasks.find(x=>x.id===taskId);
    if (!t) return unknownId;
    const sid = (t.status_id && statusesById[t.status_id]) ? (t.status_id as string) : unknownId;
    return sid;
  };
  return { columns, order, unknownId, statusForTask } as const;
}

function handleFor(u: User) {
  const local = (u.email || '').split('@')[0] || u.display_name.replace(/\s+/g,'').toLowerCase();
  return `@${local}`;
}

function TaskCard({ task, project, tags, assignees, columnId, draggingId, dragOverInfo, onDragStart, onDragOverCard, onDropOnCard, onOpen, onToggleCompleted, extraKBProps }:{ task: Task, project?: Project, tags?: Tag[], assignees?: User[], columnId: string, draggingId?: string|null, dragOverInfo?: { colId: string; targetId?: string; pos: 'before'|'after'|'end' } | null, onDragStart: (t: Task) => void, onDragOverCard: (targetId: string, pos: 'before'|'after') => void, onDropOnCard: (targetId: string, pos: 'before'|'after') => void, onOpen?: ()=>void, onToggleCompleted?: (next:boolean)=>void, extraKBProps?: any }){
  const isDragging = draggingId === task.id;
  const showBefore = dragOverInfo && dragOverInfo.colId === columnId && dragOverInfo.targetId === task.id && dragOverInfo.pos === 'before';
  const showAfter = dragOverInfo && dragOverInfo.colId === columnId && dragOverInfo.targetId === task.id && dragOverInfo.pos === 'after';
  return (
    <div
      className={`border border-[var(--stroke)] bg-[var(--bg-1)] rounded-sm p-2 cursor-pointer hover:border-[var(--accent)] ${isDragging? 'opacity-70 rotate-[0.5deg]': ''} ${showBefore? 'shadow-[0_-2px_0_#8B5CF6_inset]': ''} ${showAfter? 'shadow-[0_2px_0_#8B5CF6_inset]': ''}`}
      onClick={onOpen}
      draggable
      onDragStart={(e)=>{
        try { e.dataTransfer.setData('application/json', JSON.stringify({ taskId: task.id, fromColId: columnId })); } catch {}
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(task);
      }}
      onDragEnd={()=>{ /* clear via drop handlers */ }}
      onDragOver={(e)=>{
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const pos = e.clientY < rect.top + rect.height/2 ? 'before' : 'after';
        onDragOverCard(task.id, pos);
      }}
      onDrop={(e)=>{
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const pos = e.clientY < rect.top + rect.height/2 ? 'before' : 'after';
        onDropOnCard(task.id, pos);
      }}
      {...extraKBProps}
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
