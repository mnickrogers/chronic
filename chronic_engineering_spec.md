# Chronic — Engineering Spec (v1, Consolidated)

> Scope: Implements PRD v1 (Consolidated). Python/FastAPI backend, Postgres multitenant with org‑scoped RLS, Redis for pub/sub and jobs, Next.js/React/TS frontend. Realtime via WebSockets. Email via SendGrid. Desktop + mobile web.

---

## 0) Architecture Overview
- **Frontend**: Next.js + React + TypeScript; Tailwind + shadcn/ui. TanStack Query for server state; Zustand for light local UI state. WebSocket client for realtime events. OpenAPI‑generated client.
- **Backend**: FastAPI (ASGI) with Pydantic v2 models; Uvicorn; behind ALB/NGINX. JWT sessions (HttpOnly cookies, SameSite=Lax, Secure). App‑layer RBAC for workspace/project visibility.
- **DB**: Postgres 16 (AWS RDS). **RLS** enforces org isolation. SQLAlchemy 2 + Alembic. PITR on.
- **Cache & Jobs**: Redis (ElastiCache) for pub/sub and Celery broker. Workers for emails, dependency roll‑forward, digests, cleanup.
- **Email**: SendGrid API for verification codes, invites, transactional notifications, digests.
- **Observability**: Sentry + OpenTelemetry; JSON logs to CloudWatch.

---

## 1) Security & Auth
- **Identity**: email + password (argon2id hash). Google SSO fast‑follow.
- **Session**: short‑lived access JWT in HttpOnly cookie; refresh cookie with rotation. CSRF double‑submit header for non‑idempotent requests.
- **Signup**: 6‑digit email code (10‑min TTL) before provisioning org/domain.
- **Password reset**: tokenized link (60‑min TTL, single use). In‑session Change Password requires current password.
- **Rate limiting**: Redis sliding window for verify, login, reset, invites.
- **Sanitization**: comments/description are rich text → sanitize to a safe subset.

---

## 2) Multitenancy & RLS
- Every row includes `org_id`. RLS policies filter by `org_id = current_setting('app.current_org_id')::uuid`.
- Request middleware sets `SET LOCAL app.current_user_id`, `app.current_org_id` per connection; Celery does the same before DB calls.
- Application guards enforce workspace/project visibility, private vs org‑public rules, and membership/roles.

**Example policy**
```sql
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_same_org ON tasks
USING (org_id = current_setting('app.current_org_id')::uuid)
WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);
```

---

## 3) Data Model (DDL Sketch)
### 3.1 Org & identity
- `organizations(id uuid pk, name text, primary_domain text, created_at timestamptz, owner_user_id uuid)`
- `org_domains(id uuid pk, org_id uuid fk, domain text unique, added_by uuid, created_at timestamptz)`
- `users(id uuid pk, email citext unique, password_hash text, display_name text, created_at timestamptz, timezone text)`
- `org_memberships(id uuid pk, org_id uuid fk, user_id uuid fk, role text check(role in('owner','admin','member')), is_owner boolean default false, created_at timestamptz, unique(org_id,user_id))`
- `email_verifications(id uuid pk, email citext, code_hash text, expires_at timestamptz, consumed_at timestamptz)`
- `password_reset_tokens(id uuid pk, user_id uuid fk, token_hash text, expires_at timestamptz, used_at timestamptz)`
- `invites(id uuid pk, org_id uuid fk, inviter_user_id uuid fk, email citext, scope text check(scope in('org','workspace','project')), scope_id uuid, token_hash text, expires_at timestamptz, accepted_at timestamptz)`

### 3.2 Workspaces & projects
- `workspaces(id uuid pk, org_id uuid fk, name text, created_by uuid, created_at timestamptz, deleted_at timestamptz null)`
- `workspace_memberships(id uuid pk, workspace_id uuid fk, user_id uuid fk, role text check(role in('admin','member')), created_at timestamptz, unique(workspace_id,user_id))`
- `projects(id uuid pk, org_id uuid fk, workspace_id uuid fk, name text, visibility text check(visibility in('private','org_public')), created_by uuid, created_at timestamptz, deleted_at timestamptz)`
- `project_memberships(id uuid pk, project_id uuid fk, user_id uuid fk, role text check(role in('editor','viewer')), created_at timestamptz, unique(project_id,user_id))`
- `project_statuses(id uuid pk, project_id uuid fk, key text, label text, position int, is_done boolean)`
- `project_sections(id uuid pk, project_id uuid fk, name text, position int)`

### 3.3 Tasks & relations
- `tasks(id uuid pk, org_id uuid fk, workspace_id uuid fk, project_id uuid fk, parent_id uuid fk null, name text, description jsonb, status_id uuid fk, priority smallint check(priority between 0 and 3), due_date date, start_date date, end_date date, is_completed boolean default false, created_by uuid, created_at timestamptz, completed_at timestamptz)`
- `task_assignees(task_id uuid fk, user_id uuid fk, primary key(task_id,user_id))`
- `task_dependencies(predecessor_id uuid fk, dependent_id uuid fk, primary key(predecessor_id,dependent_id))`
- `tags(id uuid pk, workspace_id uuid fk, name text, color text)`
- `task_tags(task_id uuid fk, tag_id uuid fk, primary key(task_id,tag_id))`
- `comments(id uuid pk, org_id uuid fk, task_id uuid fk, project_id uuid fk null, author_id uuid fk, body jsonb, created_at timestamptz, edited_at timestamptz, deleted_at timestamptz)`
- `comment_reactions(comment_id uuid fk, user_id uuid fk, emoji text, primary key(comment_id,user_id,emoji))`

### 3.4 Custom fields & saved views
- `custom_field_defs(id uuid pk, workspace_id uuid fk, name text, type text check(type in('text','number','single','multi','date','checkbox','user','url')), required boolean default false)`
- `custom_field_options(id uuid pk, field_id uuid fk, key text, label text, color text, position int)`
- `project_custom_fields(project_id uuid fk, field_id uuid fk, visible boolean default true, default_value jsonb, primary key(project_id,field_id))`
- `task_custom_field_values(task_id uuid fk, field_id uuid fk, value jsonb, primary key(task_id,field_id))`
- `saved_views(id uuid pk, org_id uuid fk, scope text check(scope in('workspace','project')), scope_id uuid, owner_user_id uuid, visibility text check(visibility in('workspace','org')), allow_collab boolean default false, name text, config jsonb, created_at timestamptz, updated_at timestamptz)`

### 3.5 Notifications & prefs
- `notifications(id uuid pk, user_id uuid fk, type text, payload jsonb, created_at timestamptz, read_at timestamptz)`
- `notification_prefs(user_id uuid pk, settings jsonb)`

> Note: v1 ships **no system‑wide audit log**; keep user‑facing edit history at the application level on comments/descriptions.

---

## 4) API Surface (REST)
Base: `/api/v1` (FastAPI OpenAPI/Swagger).

**Auth**
- `POST /auth/signup` {email, password} → 204 (sends code)
- `POST /auth/verify-email` {email, code} → {session}
- `POST /auth/login` {email, password} → {session}
- `POST /auth/logout` → 204
- `POST /auth/forgot-password` {email} → 204
- `POST /auth/reset-password` {token, new_password} → 204

**Orgs & domains**
- `GET /orgs/current`
- `POST /orgs/aliases` {email_at_alias} → 204 (sends code)
- `POST /orgs/aliases/verify` {email, code} → 204

**Workspaces**
- `GET /workspaces`
- `POST /workspaces` {name}
- `DELETE /workspaces/{id}`
- `POST /workspaces/{id}/members` {user_id, role}

**Projects**
- `GET /workspaces/{id}/projects`
- `POST /projects` {workspace_id, name, visibility}
- `GET /projects/{id}`
- `PATCH /projects/{id}` {name, visibility}
- `DELETE /projects/{id}` (soft)
- `POST /projects/{id}/restore`
- `POST /projects/{id}/members` {user_id, role}
- `GET /projects/{id}/statuses`
- `POST /projects/{id}/statuses` {label, is_done, position}

**Tasks**
- `GET /projects/{id}/tasks` (filters)
- `POST /tasks` {...}
- `GET /tasks/{id}`
- `PATCH /tasks/{id}` {...}
- `DELETE /tasks/{id}`
- `POST /tasks/{id}/assignees` {user_id}
- `DELETE /tasks/{id}/assignees/{user_id}`
- `POST /tasks/{id}/dependencies` {predecessor_id | dependent_id}
- `DELETE /tasks/{id}/dependencies/{other_task_id}`
- `POST /tasks/{id}/complete` / `POST /tasks/{id}/reopen`

**Comments**
- `GET /tasks/{id}/comments`
- `POST /tasks/{id}/comments` {body}
- `PATCH /comments/{id}` {body}
- `DELETE /comments/{id}`
- `POST /comments/{id}/reactions` {emoji}
- `DELETE /comments/{id}/reactions/{emoji}`

**Saved views**
- `POST /saved-views` {scope, scope_id, name, config, visibility, allow_collab}
- `GET /saved-views/{id}` / `PATCH /saved-views/{id}` / `DELETE /saved-views/{id}`

**Search**
- `GET /search` ?q= … filters (project, workspace, assignee, status, tag, priority, due window)

**Notifications**
- `GET /notifications` / `PATCH /notifications/{id}` {read_at}
- `GET /notification-prefs` / `PATCH /notification-prefs` {settings}

**Realtime**
- `WS /ws` → authenticate then subscribe to channels via messages: `{subscribe: project:UUID}` etc.

---

## 5) Permissions (App Guards)
- **Project visibility**: `private` → only explicit members (creator auto‑editor). `org_public` → all org members can read + comment; editors = workspace members + explicit editors.
- **Task edit**: project editor or workspace admin. Any **assignee** with read access can complete.
- **Status edits**: workspace admins and project editors.
- **Project delete/restore**: project creator, workspace admins, org admins.

Centralize: `can_view_project`, `can_edit_project`, `can_comment_project`, `can_edit_task`.

---

## 6) Realtime Events & Channels
- **Channels**: `user:{user_id}`, `project:{project_id}`, `workspace:{workspace_id}`.
- **Events**: `task.created/updated/deleted/completed/reopened`, `task.assignment.added/removed`, `task.dependency.added/removed/shifted`, `comment.created/updated/deleted`, `project.created/updated/deleted/restored`, `notification.created`.
- Emit after DB commit; clients update via TanStack Query cache + optimistic UI.

---

## 7) Jobs & Schedulers
- **Dependency roll‑forward**: on predecessor end change, compute delta; BFS over dependents (workspace‑bounded); shift start/end; mark At Risk if `end > due_date`; honor per‑task ignore.
- **Email**: immediate (@mentions, assignments, invites, unblocked, due‑today, overdue), hourly bundles for comment threads, daily digest at 8am local.
- **Cleanup**: expire verification codes, reset tokens; purge soft‑deleted projects >30d; sweep stale websockets.

---

## 8) Search Implementation
- `tasks.search_vector` stored column with FTS over name + description_text; triggers on insert/update.
- Trigram index on `tasks.name` for fuzzy. Keyset pagination on `(created_at, id)`.

---

## 9) Command Palette & Keyboard (Engineering)
- **Registry**: client‑side command catalog `{id, title, synonyms, enabled(ctx), run(ctx,args)}`.
- **Context**: org/workspace/project, focused entity (task id), selection set, user role; used for context‑aware ranking.
- **Catalog (v1)**: Navigation (Go: Projects/Workspace/Org; View: List/Board/Timeline); Task ops (New/Open/Complete/Assign/Set status/Set due/Set priority/Add tags/Move/Delete); Project ops (New/Rename/Change visibility/Add member/Delete); Selection ops (Assign/Set status/Set due/Add tags/Move/Delete).
- **Key handling**: single global listener; does not hijack input fields. Shortcut overlay at Cmd/Ctrl‑/.

### 9.1 Undo/Redo
- **Keybindings**: Cmd/Ctrl‑Z undo; Shift+Cmd/Ctrl‑Z redo.
- **Scope**: session‑local per tab; depth 50; entries expire after 5 minutes.
- **Impl**: client maintains command stack with inverse operations; server remains stateless and uses standard CRUD endpoints for reversals.
- **Concurrency**: use `If‑Unmodified‑Since` (or `expected_updated_at`) on PATCH/DELETE; server returns **412** with current entity on mismatch; client shows conflict toast and skips that undo item.
- **Bulk ops**: composite command; undo replays inverses in reverse order; stop on first failure; surface partial results.
- **Exclusions**: chain auto roll‑forward; present a timeline banner offering **Revert shift** that applies the inverse delta across the affected chain.
- **Metrics**: `undo.success`, `undo.conflict`, `undo.depth` gauges.

---

## 10) Migrations & Seeding
- Alembic baseline: all tables; RLS enablement + policies. Seed default project status set; optional demo data for staging.

---

## 11) Testing Strategy
- **Unit**: Pydantic schemas, permission guards, utils.
- **Integration**: API with test Postgres + Redis (pytest + httpx + anyio); exercise RLS context.
- **E2E**: Playwright for keyboard flows (Command‑K, j/k/h/l, multi‑select, bulk actions), realtime across two browsers, soft delete/restore, undo/redo, email deliverability.
- **Load**: light k6/Gatling for search and list pagination.

---

## 12) Observability & Metrics
- Traces for requests, DB, Celery tasks; attributes include org_id/workspace_id/project_id (mind PII).
- Metrics: latency (p50/p95) by endpoint, WebSocket sessions, notification send success, queue depth, roll‑forward duration.
- Structured logs with correlation ids.

---

## 13) Deployment (AWS)
- **RDS Postgres 16** Multi‑AZ, PITR.
- **ElastiCache Redis** (cluster mode disabled initially).
- **ECS Fargate** or **App Runner** for API + workers; ALB; JWT cookie auth.
- **CloudFront** CDN in front of Next.js static.
- **Secrets** in AWS Secrets Manager (DB creds, SendGrid, JWT secrets).
- **CI/CD** GitHub Actions: test → build → migrations → deploy.

---

## 14) Performance Budgets
- API p95 < 300ms for standard CRUD; search p95 < 500ms under 50k tasks/org.
- WebSocket event propagation < 1s end‑to‑end.
- First interactive < 2.5s on mid‑tier laptop; keypress‑to‑action < 100ms.

---

## 15) Security Considerations
- Argon2id with tuned params; password strength rules; optional k‑anonymity breached password check.
- JWT rotation and revocation on password reset.
- Strict input validation; XSS‑safe rendering of rich text (sanitize allowlist).
- RLS enforced for all tables with `org_id`.

---

## 16) Rollout Checklist
- Apply migrations; verify RLS.
- Seed test org; run E2E keyboard flows.
- Verify SendGrid templates and deliverability for: verification, invites, mentions, assignments, due/overdue, digest.
- Chain roll‑forward simulation across large synthetic graph.
- Dashboards live; basic on‑call runbook.

