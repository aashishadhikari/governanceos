# Permission Catalog

**Status:** Inventory of business capabilities that exist in GovernanceOS today. This is the Phase 1 deliverable referenced in `06-migration-plan.md`.

## Scope and method

This catalog only lists permissions for capabilities that are **already implemented** — verified against the actual API routes (`app/api/**/route.ts`) and the pages/components that call them. Nothing here describes a future module.

Two things are deliberately **not** given their own module section:

- **Search** (`/search`, `GET /api/search`) — a read-only aggregation over other resources. Its results should be filtered by whatever `*.view` permissions the requesting user already holds on each underlying resource type, rather than needing a separate `search.view` permission.
- **Notifications** (`GET /api/notifications/tasks`) — surfaces items (overdue compliance, expiring licenses, etc.) the user can already see via their existing `*.view` permissions on those resources.

Where a module currently has no edit or delete capability at the API level (e.g. Licenses), that gap is called out explicitly rather than assuming symmetric CRUD exists.

---

## Dashboard

Read-only aggregation view; no create/edit/delete actions of its own.

- `dashboard.view`

## Entities

Covers the Legal Entity Registry, corporate structure, and the Terms of Reference (ToR) generator.

- `entity.view`
- `entity.create`
- `entity.edit`
- `entity.delete`
- `entity.tor.generate` — generate a Board Terms of Reference document (`POST /api/entities/:id/tor`)
- `entity.tor.settings.manage` — view/update ToR generation settings for an entity (`GET`/`PUT /api/entities/:id/tor/settings`)

## Organization Chart

Read-only visualization of the entity hierarchy. No independent data of its own — it renders `entity.view` data.

- `orgchart.view`

## Governance Team

(Directors — labeled "Governance Team" in the UI.)

- `director.view`
- `director.create`
- `director.edit`
- `director.delete`

## Board Meetings

Note: there is currently **no delete capability** for board meetings, resolutions, or meeting documents at the API level — only create and update/create-child-record exist.

- `meeting.view`
- `meeting.create`
- `meeting.edit`
- `meeting.resolution.create` — record a resolution against a meeting (`POST /api/board-meetings/:id/resolutions`)
- `meeting.document.upload` — attach a document record to a meeting (`POST /api/board-meetings/:id/documents`)

## Calendar

("Key Dates" in the main nav, and the regulatory calendar view under Compliance.) Read-only surface over Compliance and Board Meeting due dates — no independent CRUD.

- `calendar.view`

## Compliance

Covers Compliance & Finance obligations, plus bulk import/clear operations.

- `compliance.view`
- `compliance.create`
- `compliance.edit`
- `compliance.delete`
- `compliance.import` — bulk-import compliance obligations from CSV (`POST /api/compliance/import`)
- `compliance.clear` — bulk-delete compliance obligations (`DELETE /api/compliance/clear`)
- `compliance.calendar.import` — import a regulatory calendar (JSON) into compliance obligations (`POST /api/compliance/calendar`)

## Licenses

Note: only **view** and **create** exist today — there is no `PATCH`/`DELETE` route for an individual license, so `license.edit` and `license.delete` are intentionally omitted until that functionality is built.

- `license.view`
- `license.create`

## Regulatory Capital

Covers regulatory capital records and linked bank accounts.

- `capital.view`
- `capital.edit` — update capital balance/requirement fields (`PATCH /api/capital`)
- `capital.import` — bulk-import bank account data from CSV (`POST /api/capital/import`)
- `capital.bank_sync` — sync/refresh bank account and capital balances (`GET`/`POST /api/capital/bank-sync`)

## Alerts

- `alert.view`
- `alert.update` — mark alerts read/dismissed (`PATCH /api/alerts`)
- `alert.generate` — manually trigger alert/health-score generation (`POST /api/alerts/generate`)

## Document Vault

- `document.view`
- `document.upload`
- `document.download`
- `document.delete` — soft delete (`DELETE /api/documents/:id`)

## Users

(User Management, `/admin/users`.)

- `user.view`
- `user.create`
- `user.edit`
- `user.deactivate` — soft-deactivate a user (`DELETE /api/users/:id`)
- `user.reactivate` — reactivate a deactivated user (`PATCH /api/users/:id` with `isActive: true`)
- `user.password_reset.send` — resend a password setup/reset invitation (`POST /api/users/:id/resend-invitation`)

## Roles

(Role Management, `/admin/roles`.)

- `role.view`
- `role.create`
- `role.edit`
- `role.delete` — subject to the existing system-role and assigned-user guards in `DELETE /api/roles/:id`

## Submissions

(Bug/feature submissions triaged by admins, `/admin/submissions`.)

- `submission.view`
- `submission.create` — any authenticated user can submit feedback (`POST /api/submissions`)
- `submission.approve`
- `submission.reject`
- `submission.status.update` — transition a submission through `implementing`/`done` states

---

## Summary table

| Module | Permissions |
|---|---|
| Dashboard | 1 |
| Entities | 6 |
| Organization Chart | 1 |
| Governance Team | 4 |
| Board Meetings | 5 |
| Calendar | 1 |
| Compliance | 7 |
| Licenses | 2 |
| Regulatory Capital | 4 |
| Alerts | 3 |
| Document Vault | 4 |
| Users | 6 |
| Roles | 4 |
| Submissions | 5 |
| **Total** | **53** |
