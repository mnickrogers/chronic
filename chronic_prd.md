# Chronic — Product Requirements Document (v1, Consolidated)

## 1) Summary & Vision
Chronic is a fast, opinionated task manager for small teams (5–50). It adopts familiar models from Asana but emphasizes speed, clarity, and a **keyboard‑first, non‑modal UX**: a global **Command‑K** palette with context‑aware ranking, vim‑style navigation keys (coexisting with mouse), and robust multi‑select + bulk actions. v1 delivers: clear Org → Workspace → Project structure, private vs org‑public projects, flexible project‑scoped statuses, realtime collaboration, a timeline with dependencies and chain roll‑forward, saved views, and pragmatic notifications.

## 2) Goals
- Let new teams sign up, auto‑provision an org by email domain, and begin planning within minutes.
- Enable private projects by default and org‑public visibility when needed.
- Provide a crisp task model: multi‑assignee, P0–P3 priority, start/end/due dates, arbitrary subtasks, cross‑project dependencies (within a workspace).
- Deliver core views: List, Board, and Timeline with dependencies and auto roll‑forward.
- Ship a Superhuman‑style keyboard experience (Command‑K, shortcuts, multi‑select) without sacrificing mouse usability.
- Keep users informed with in‑app and email notifications, with sane defaults and user controls.

## 3) Non‑Goals (v1)
- Native mobile apps (desktop + mobile web only).
- Offline/PWA editing (deferred to v2).
- External calendar or Slack/Teams sync.
- Recurring tasks.
- File uploads.
- Enterprise SSO beyond Google fast‑follow.
- Public API for 3rd‑party integrations.
- System‑wide audit log (user‑facing edit history only).

## 4) Personas
- **Team Lead**: creates workspaces/projects, monitors progress, manages visibility.
- **IC**: creates/completes tasks, comments, updates status/dates.
- **Coordinator/PM**: builds saved views, manages dependencies, tracks risks, configures notifications.

## 5) Key Decisions (Summary)
- **Tenancy**: Org → Workspaces. Users can belong to multiple orgs and workspaces.
- **Domain‑to‑Org**: After email verify (6‑digit, 10‑min TTL), create or join org by domain. **First‑come wins**; block second org for the same domain. **Alias domains** require code verification sent to an email at that alias. **Freemail** → personal org unless invited.
- **Roles**: Org Owner = Admin + ownership transfer; Org Admin; Workspace Admin/Member. **Anyone can create projects**.
- **Project visibility**: **Private** (creator‑only by default; explicit adds) or **Org‑public** (visible org‑wide; non‑workspace members can view + comment; editing reserved to workspace members and explicit project editors).
- **Deletion**: Projects soft‑delete (30‑day restore). Deleters = project creator, Workspace Admins, Org Admins.
- **Tasks**: multi‑assignee; `created_by`, `created_at`; P0–P3; start/end/due; tags; description/comments; project‑scoped statuses (default: Backlog, In Progress, Blocked, Done); single‑project scope.
- **Subtasks**: arbitrary depth; **Balanced** inheritance — copy tags + status at create, independent after; parent Done requires all children Done by default, manual override allowed.
- **Dependencies**: cross‑project inside the same workspace. **Auto roll‑forward**: chain‑propagate start/end by delta when a predecessor slips; keep duration; don’t move due date; mark **At Risk** when `end > due`; per‑task ignore toggle.
- **Views**: List, Board (group by status/assignee/tag/section), Timeline; **Saved views** with workspace/org visibility; owner edits; others can duplicate; optional allow‑collab toggle.
- **Keyboard**: non‑modal; Command‑K palette (global, context‑aware ranking); explicit commands only (no NLU in v1); vim keys for navigation; **multi‑select + bulk actions**; shortcut overlay (Cmd/Ctrl‑/).
- **Undo/Redo**: Cmd/Ctrl‑Z and Shift+Cmd/Ctrl‑Z; covers common task/project edits; timeline auto roll‑forward uses a separate **Revert shift** action.
- **History**: **User‑facing edit history** for task descriptions and comments; **no system audit log** in v1.

## 6) User Journeys (with Acceptance Criteria)
### A. Sign up & Org provisioning
- Email + password → receive a **6‑digit** code (10‑min TTL). On verify, create/join org by domain; freemail → personal org unless invited.
**Acceptance**: completes in <2 minutes; clear errors; resend cooldown; rate‑limited.

### B. Add alias domain
- Org Admin enters an email at the alias domain → code sent → verify (10‑min) → alias added.
**Acceptance**: future signups on alias auto‑join the org; removing alias stops future auto‑joins without removing existing users.

### C. Create a workspace & project
- User with edit access creates a workspace (per role). Anyone can create a project (private by default, or org‑public).
**Acceptance**: visibility explained at creation; adding members is clear.

### D. Create & manage tasks
- Create tasks with required fields (see Decisions). Quick add, keyboard shortcuts, bulk edits via multi‑select.
**Acceptance**: keyboard completes all core actions without mouse.

### E. Subtasks & roll‑up
- Create arbitrary‑depth subtasks; parent completion requires children Done by default (override allowed). Roll‑up progress indicator; overdue child shows **At Risk**.
**Acceptance**: parent override shows a warning; child changes do not auto‑cascade.

### F. Dependencies & timeline
- Add dependencies across projects (same workspace). If a predecessor slips, dependent tasks shift start/end by the delta; duration preserved; due date static; At Risk flagged.
**Acceptance**: timeline updates instantly; per‑task ignore toggle; **Revert shift** undo on banner.

### G. Views & saved views
- List/Board/Timeline; saved views with workspace/org visibility; owner edits, others duplicate; optional collaborator editing toggle.
**Acceptance**: saved view creation/sharing is obvious; filters persist.

### H. Comments & notifications
- Rich‑text comments, @mentions, emoji. In‑app for all relevant events. Email: @mentions, new assignments, invites, dependency unblocked (only when your task is unblocked), due‑today, overdue; hourly bundled thread replies; optional daily digest.
**Acceptance**: toggles, quiet hours, and unsubscribe to preferences work.

### I. Search, quick add, and Command‑K
- Global search with filters; Command‑K for commands (explicit names), context‑aware ranking; vim‑style navigation (`j/k`, `h/l`), multi‑select (`x`, `Shift+J/K`), and bulk actions.
**Acceptance**: every Journey C–H is completable via keyboard alone.

### J. Undo/Redo
- Cmd/Ctrl‑Z undo; Shift+Cmd/Ctrl‑Z redo; scope includes status/priority/assignees/dates/tags/complete‑reopen/create‑delete (soft)/bulk/project visibility.
**Acceptance**: conflicts show a toast; timeline chain shifts use **Revert shift**.

## 7) Functional Requirements
### 7.1 Account & Auth
- Email + password, 6‑digit verification code (10‑min TTL). Forgot password via tokenized link (60‑min TTL, single use). Google SSO fast‑follow.

### 7.2 Orgs, Domains, Workspaces
- Auto org creation/join by verified domain; first‑come wins. Freemail → personal org unless invited. Alias domains via code‑verified email at alias domain. Workspace creation, membership, Admin/Member roles.

### 7.3 Projects
- Single‑workspace scope. Private or org‑public. Templates supported. **Custom fields** workspace‑scoped (Text, Number, Single‑select, Multi‑select, Date, Checkbox, User, URL). Soft delete with 30‑day restore (type name to confirm).

### 7.4 Tasks & Subtasks
- Fields: name, description, priority P0–P3, status, tags, assignees (multi), due/start/end dates, `created_by`, `created_at`, `completed_at`.
- Arbitrary depth subtasks; Balanced inheritance; dependency constraints within workspace.
- Status sets are **project‑specific**; default provided.

### 7.5 Views & Saved Views
- List, Board, Timeline. Saved views: workspace‑visible (workspace views) or org‑visible (org‑public project views). Owner edits; others duplicate; optional allow‑collab toggle.

### 7.6 Comments & History
- Rich‑text comments, @mentions, emoji. **User‑facing edit history** for descriptions and comments.

### 7.7 Notifications
- In‑app realtime for task/project/invite events affecting the user. Email immediate: @mentions, new assignments, project invites, dependency unblocked, due‑today, overdue. Hourly bundling for comment threads on assigned tasks. Optional daily digest (8am local). Per‑event toggles, quiet hours, snooze per thread, unsubscribe to preferences.

### 7.8 Search & Navigation
- Global search with filters and saved searches. Keyboard quick add and Command‑K command execution.

### 7.9 Keyboard‑First (non‑modal)
- Command‑K/Ctrl‑K global palette (context‑aware ranking). Explicit commands only (v1). Vim‑style navigation (`j/k` up/down, `h/l` left/right), `Enter`/`o` open, `Esc` close. Shortcut overlay (Cmd/Ctrl‑/). Multi‑select (`x`, `Shift+J/K`), bulk actions (status, assign, due, tags, priority, move, delete). Views: `v b`, `v l`, `v t`; Go‑to: `g p`, `g w`, `g o`; new task `n`; assign `a`; status `s`; due `d`; tags `t`; priority `p`; move `m`; comment `c`; complete Space or Cmd/Ctrl‑Enter; delete Cmd/Ctrl‑Backspace.

### 7.10 Undo/Redo
- Cmd/Ctrl‑Z undo; Shift+Cmd/Ctrl‑Z redo. Supported for: status, priority, assignees, due/start/end dates, tags, complete/reopen, create/delete (soft) at project scope, bulk actions, project visibility. Excludes chain auto roll‑forward (banner with **Revert shift**).

## 8) Non‑Functional Requirements
- Realtime updates over WebSockets. Snappy interactions for small‑team datasets. Responsive desktop and mobile web.
- Soft delete for projects (30 days). Rate limits on auth and invites. Basic analytics/telemetry.
- Security: hashed tokens/codes with TTLs; org isolation (enforced in backend). Backups: daily snapshots + PITR.

## 9) Permissions & Visibility
- **Org‑public project**: visible org‑wide; non‑workspace members can view + comment; editing limited to workspace members and explicit project editors.
- **Private project**: creator‑only by default; explicit adds required.
- **Workspace roles**: Admin manages settings/members/projects; Member can create projects and create/edit/complete tasks.
- **Deletion rights**: project creator, workspace admins, org admins (admin settings) can delete/restore projects.

## 10) Information Architecture & Data Model (overview)
Entities: Organization, OrgDomain, User, OrgMembership, Workspace, WorkspaceMembership, Project, ProjectMembership, ProjectStatus, ProjectSection, Task, TaskAssignee, TaskDependency, Tag, TaskTag, Comment, CommentReaction, CustomFieldDef (workspace‑scoped), CustomFieldOption, ProjectCustomField, TaskCustomFieldValue, SavedView, Notification, NotificationPreference, Invite, EmailVerification, PasswordResetToken.

## 11) Analytics & Telemetry
- Events: task_created/updated/completed, dependency_added/shifted, project_created/visibility_changed/deleted/restored, comment_added, mention_sent, notification_email_sent, signup_completed, invite_accepted.
- Dashboards: active users/day, projects per workspace, tasks created/completed/day, overdue by project, notification volume.

## 12) Release Criteria (v1 GA)
- Journeys A–J functional and covered by E2E tests (keyboard flows, realtime updates, undo/redo, soft delete/restore, email deliverability via SendGrid).
- WebSocket event propagation < 1s E2E in test; search returns in < 500ms on seed data.

## 13) Risks & Mitigations
- **Domain auto‑grouping confusion** → clear signup copy, link to contact org admin if mismatch.
- **Unexpected auto roll‑forward shifts** → timeline banners explain deltas; **Revert shift** action.
- **Multi‑assignee ambiguity** → any assignee can complete; audit in comments.
- **Notification fatigue** → conservative email defaults and easy toggles.

## 14) Design System

The design takes from a retro terminal feel with dark colors and light borders around content.

The design color theme should be modular. We'll come back and add selectable color themes later, so the initial colors outlined below are just the default (a start).

We also provide design mocks for all the major screens. These can be used to infer the intended design language for the rest of the screens that we have not explicitly mocked yet.

### Colors
- Primary background color: #222227
- Secondary background color: #2B2B31
- Stroke color (accent): #9F9FBF
- Highlight color: #7878A9

### Fonts
The main font is IBM Plex Mono, a monospaced font.

We can import IBM Plex Mono using the following HTML code:

```HTML
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet">
```

Then we can use the font in CSS:

```CSS
font-family: "IBM Plex Mono", monospace;
```

### Mocks

- `chronic_main_tasks_view.png` - this file defines the UI for the main task landing page that displays all the tasks a user has created.
- `chronic_single_task_view.png` - this image mocks the single task view that opens when a user clicks on a task or hits return with a task highlighted. The task pop-up displays over the existing view, with the background view slightly darkened. The top part of the task view displays task metadata and the task name, which can all be edited this way. The bottom part of the view is the free-form text edit field.
- `chronic_projects_view.png` - this mock displays the projects page (selected via the left nav bar).
- `chronic_projects_tasks_view.png` - this mock shows what a user sees when drilling into a specific project. The user can navigate back to the projects view by selecting the back arrow to the left of the project name. The task list here looks just like the standard list view that the "All Tasks" view displays.

