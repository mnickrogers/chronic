export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api';

type HTTPMethod = 'GET'|'POST'|'PATCH'|'DELETE';

async function request<T>(path: string, opts: { method?: HTTPMethod, body?: any } = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  me: () => request('/auth/me'),
  login: (email: string, password: string) => request('/auth/login', { method: 'POST', body: { email, password } }),
  signup: (email: string, password: string, display_name: string) => request('/auth/signup', { method: 'POST', body: { email, password, display_name } }),
  listWorkspaces: () => request('/orgs/current/workspaces'),
  createWorkspace: (name: string) => request('/orgs/current/workspaces', { method: 'POST', body: { name } }),
  listProjects: (workspaceId: string) => request(`/projects/workspace/${workspaceId}`),
  createProject: (workspaceId: string, name: string, visibility: string='private') => request(`/projects/workspace/${workspaceId}`, { method: 'POST', body: { name, visibility } }),
  deleteProject: (projectId: string) => request(`/projects/${projectId}`, { method: 'DELETE' }),
  getStatuses: (projectId: string) => request(`/projects/${projectId}/statuses`),
  listTasks: (projectId: string) => request(`/tasks/project/${projectId}`),
  createTask: (projectId: string, name: string, status_id?: string) => request(`/tasks/project/${projectId}`, { method: 'POST', body: { name, status_id } }),
  listWorkspaceTasks: (workspaceId: string) => request(`/tasks/workspace/${workspaceId}`),
  createWorkspaceTask: (workspaceId: string, name: string, project_id?: string | null, status_id?: string | null) => request(`/tasks/workspace/${workspaceId}`, { method: 'POST', body: { name, project_id, status_id } }),
  updateTask: (taskId: string, body: any) => request(`/tasks/${taskId}`, { method: 'PATCH', body }),
  deleteTask: (taskId: string) => request(`/tasks/${taskId}`, { method: 'DELETE' }),
  // Workspace members
  listWorkspaceMembers: (workspaceId: string) => request(`/orgs/workspaces/${workspaceId}/members`),
  addWorkspaceMember: (workspaceId: string, body: { user_id?: string, email?: string, display_name?: string }) => request(`/orgs/workspaces/${workspaceId}/members`, { method: 'POST', body }),
  removeWorkspaceMember: (workspaceId: string, userId: string) => request(`/orgs/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' }),
  // Project members
  listProjectMembers: (projectId: string) => request(`/projects/${projectId}/members`),
  addProjectMember: (projectId: string, user_id: string) => request(`/projects/${projectId}/members`, { method: 'POST', body: { user_id } }),
  removeProjectMember: (projectId: string, userId: string) => request(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
  // Task assignees
  listTaskAssignees: (taskId: string) => request(`/tasks/${taskId}/assignees`),
  addTaskAssignee: (taskId: string, user_id: string) => request(`/tasks/${taskId}/assignees`, { method: 'POST', body: { user_id } }),
  removeTaskAssignee: (taskId: string, userId: string) => request(`/tasks/${taskId}/assignees/${userId}`, { method: 'DELETE' }),
  // Tags
  listTags: (workspaceId: string) => request(`/tags/workspace/${workspaceId}`),
  createTag: (workspaceId: string, name: string, color?: string) => request(`/tags/workspace/${workspaceId}`, { method: 'POST', body: { name, color } }),
  updateTag: (tagId: string, body: any) => request(`/tags/${tagId}`, { method: 'PATCH', body }),
  deleteTag: (tagId: string) => request(`/tags/${tagId}` , { method: 'DELETE' }),
  listTaskTags: (taskId: string) => request(`/tasks/${taskId}/tags`),
  addTaskTag: (taskId: string, tag_id: string) => request(`/tasks/${taskId}/tags`, { method: 'POST', body: { tag_id } }),
  removeTaskTag: (taskId: string, tagId: string) => request(`/tasks/${taskId}/tags/${tagId}`, { method: 'DELETE' }),
  listProjectTags: (projectId: string) => request(`/projects/${projectId}/tags`),
  addProjectTag: (projectId: string, tag_id: string) => request(`/projects/${projectId}/tags`, { method: 'POST', body: { tag_id } }),
  removeProjectTag: (projectId: string, tagId: string) => request(`/projects/${projectId}/tags/${tagId}`, { method: 'DELETE' }),
};
