import type { Status } from "@/components/TaskList";

// Default project status set per PRD:
// Backlog, In Progress, Blocked, Done
export const DEFAULT_STATUSES: Status[] = [
  { id: 'default:backlog', label: 'Backlog', is_done: false },
  { id: 'default:in_progress', label: 'In Progress', is_done: false },
  { id: 'default:blocked', label: 'Blocked', is_done: false },
  { id: 'default:done', label: 'Done', is_done: true },
];

