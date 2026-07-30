# RBAC Implementation Log

**Status:** Living document. Tracks what has actually been built against the roadmap in `06-migration-plan.md`, as it happens — updated incrementally as each phase ships, not written up-front. This is the factual record of *what exists in the codebase today*; `01`–`06` describe the *design*.

## Migration plan status

| Phase | Description | Status |
|---|---|---|
| 1 | Permission catalog | ✅ Done |
| 2 | Database schema | ✅ Done |
| 3 | Role-Permission UI | ✅ Done |
| 4 | API enforcement | ✅ Done for every module in the Phase 1 catalog |
| 5 | Frontend enforcement | 🟡 Partial — page-level `AccessDenied` shipped everywhere; navigation (Sidebar) still unmigrated |
| 6 | Testing | 🟡 Partial — engine unit tests exist; per-route enforcement was verified manually, module by module, not by an automated suite |

**As of this document, every cataloged module rejects unpermitted API calls with `403` and every cataloged page renders `AccessDenied` instead of its normal content when the caller lacks the required permission.** The one deliberate exception is navigation: `Sidebar.tsx` still decides what to *show* using the pre-RBAC legacy `UserRole` enum map, not the real permission set — every module's nav item, without exception, including ones fully enforced at the API/page layer. This is not a gap that was missed; it was explicitly deferred every time it came up, to be done as a single, atomic migration across all nav items at once rather than piecemeal (see "Known deferred work" below).

## Phase 1 — Permission catalog

Documented in `02-permission-catalog.md`: 53 permissions across all 14 modules that existed at the time, following the `resource.action` naming convention (`01-rbac-overview.md`). No code changes in this phase — inventory only.

## Phase 2 — Database schema

**Schema changes** (`prisma/schema.prisma`):
- `Permission` model — `id`, `code` (unique), `name`, `description`, `module`, timestamps. Indexed on `module`.
- `RolePermission` model — join table between `Role` and `Permission`. Composite unique on `(roleId, permissionId)`. Both FKs cascade on delete.
- `Role.permissions RolePermission[]` — the only change to an existing model.

**Migration:** `prisma/migrations/20260729075429_add_permission_and_role_permission/` — purely additive.

**Seed scripts:**
- `scripts/seed-permissions.ts` — seeds the Phase 1 catalog, upserting on `code`. Idempotent. Never assigns permissions to roles.
- `scripts/seed-role-permissions.ts` — assigns permission sets to the five system roles by resolving `role.name`/`permission.module`/`code` dynamically. Never touches custom roles. Idempotent.

**Also shipped in this phase (backfill, not part of the original Phase 2 scope but load-bearing for everything after it):**
- `scripts/check-user-roleids.ts` — read-only verification of the User → Role migration.
- `scripts/backfill-user-roles.ts` — one-time, idempotent backfill assigning `roleId` to every pre-existing user by mapping their legacy `role` enum to the matching system `Role`. Verified: 13/13 users migrated, 0 remaining nulls.

## Phase 3 — Role-Permission UI

- `components/roles/RolePermissionViewer.tsx` — dual-mode: read-only ("Platform Managed" badge) for system roles, fully editable (checkbox grid grouped by module, dirty-state detection, Cancel/Save) for custom roles.
- `PATCH /api/roles/:id/permissions` — atomic delete+recreate of a custom role's `RolePermission` rows.
- `GET /api/permissions` — read-only catalog listing, used by the editor to render permissions a role does *not* yet have.
- `components/roles/CloneRoleDialog.tsx` + `POST /api/roles/:id/clone` — clones a role's permission set (system or custom source) into a new custom role.
- `lib/auth/permissions.ts` — the authorization engine itself (`hasPermission`/`hasAnyPermission`/`hasAllPermissions`/`requirePermission`), framework-agnostic, no role special-casing. Covered by a 24-test Vitest suite (`lib/auth/permissions.test.ts`, see `docs/testing/unit-tests.md`).
- `lib/auth/session.ts` — the HTTP-facing `authorizeRequest()` wrapper (turns a failed `requirePermission` check into a `403 NextResponse`) plus `getAuthSession()`/`unauthorized()`/`forbidden()`.

This phase shipped ahead of this log being kept current — it predates the module-by-module Phase 4 rollout documented below, but nothing in it enforces anything on its own; it only became load-bearing once Phase 4 started calling it.

## Phase 4 — API enforcement

**The pattern, applied identically across every module:**

```text
authorizeRequest(PermissionCodes.X)   // API route — first statement in the handler
        │
        ▼
   denied? ──yes──▶ 403 { error: "Forbidden. Missing permission: X" }
        │no
        ▼
   existing business logic, unchanged
```

```text
getAuthSession()                       // Server Component page
        ▼
hasPermission(session, PermissionCodes.X)
        ▼
   denied? ──yes──▶ <AccessDenied message="..." />, nothing else renders
        │no
        ▼
   existing data-loading + render, unchanged
```

`lib/auth/permission-codes.ts` (`PermissionCodes`) is the single source of truth for the string codes used everywhere — every constant added maps 1:1 to an already-seeded `Permission.code`; no permission was ever invented that wasn't already in the Phase 1 catalog and `scripts/seed-permissions.ts`.

### Per-module results

| Module | Permissions enforced | API files | Page(s) |
|---|---|---|---|
| Roles | `role.view/create/edit/delete` | `app/api/roles/route.ts`, `[id]/route.ts`, `[id]/permissions/route.ts`, `[id]/clone/route.ts`, `app/api/permissions/route.ts` | `app/admin/roles/page.tsx` |
| Users | `user.view/create/edit/deactivate/password_reset.send` | `app/api/users/route.ts`, `[id]/route.ts`, `active/route.ts`, `[id]/resend-invitation/route.ts` | `app/admin/users/page.tsx` |
| Entities | `entity.view/create/edit/delete/tor.generate/tor.settings.manage` | `app/api/entities/route.ts`, `[id]/route.ts`, `[id]/tor/route.ts`, `[id]/tor/settings/route.ts` | `app/entities/page.tsx` |
| Governance Team (Directors) | `director.view/create/edit/delete` | `app/api/directors/route.ts`, `[id]/route.ts` | `app/directors/page.tsx` |
| Board Meetings | `meeting.view/create/edit/resolution.create/document.upload` | `app/api/board-meetings/route.ts`, `[id]/route.ts`, `[id]/resolutions/route.ts`, `[id]/documents/route.ts` | `app/board-meetings/page.tsx`, `[id]/page.tsx`, `new/page.tsx` (conditional `MEETING_CREATE`/`MEETING_EDIT` on the existing `?edit=` branch) |
| Calendar (Key Dates) | `calendar.view` | *(none — no dedicated API; read-only aggregation)* | `app/calendar/page.tsx` |
| Compliance & Finance | `compliance.view/create/edit/delete/import/clear/calendar.import` | `app/api/compliance/route.ts`, `[id]/route.ts`, `import/route.ts`, `clear/route.ts`, `calendar/route.ts` | `app/compliance/page.tsx`, `regulatory-calendar/page.tsx` |
| Licenses | `license.view/create` | `app/api/licenses/route.ts` | `app/licenses/page.tsx` |
| Regulatory Capital | `capital.view/edit/import` | `app/api/capital/route.ts`, `balance/route.ts`, `import/route.ts` | `app/capital/page.tsx` |
| Alerts | `alert.view/update/generate` | `app/api/alerts/route.ts`, `generate/route.ts` | `app/alerts/page.tsx` (its automatic `generateAlerts()` refresh rides along under `alert.view`, not separately gated) |
| Document Vault | `document.view/upload/delete` | `app/api/documents/route.ts`, `upload/route.ts`, `[id]/route.ts` | `app/documents/page.tsx` |
| Submissions | `submission.view/create/approve/reject/status.update` | `app/api/submissions/route.ts`, `[id]/route.ts` (`PATCH` branches on the payload's business action — `approvedBy`/`approvedAt`/`status:'approved'` → `APPROVE`; the rejection equivalents → `REJECT`; else → `STATUS_UPDATE`) | `app/admin/submissions/page.tsx` |
| Organization Chart | `orgchart.view` | *(none)* | `app/org-chart/page.tsx` |
| Search | *(none — filters existing `*.view` grants per result category)* | `app/api/search/route.ts` | — |
| Dashboard | `dashboard.view` | *(none)* | `app/dashboard/page.tsx` |

### Explicitly out-of-scope endpoints (found during investigation, deliberately left unprotected by `authorizeRequest()`)

| Endpoint | Why |
|---|---|
| `POST /api/webhooks/jira` | Genuine inbound webhook from Jira's servers, authenticated via a shared `x-api-key`/`JIRA_WEBHOOK_SECRET`, no browser session to check |
| `GET /api/webhooks/jira?sync=true` | Manual Jira re-sync, browser-triggered but uncatalogued — explicitly decided not to reuse `compliance.import` for it |
| `GET/POST /api/capital/bank-sync` | External treasury/ERP integration endpoint, own `x-api-key` auth. The catalog *does* define `capital.bank_sync` for it, but `authorizeRequest()` cannot apply — the real caller has no session. `PermissionCodes` intentionally omits a `CAPITAL_BANK_SYNC` constant as a result |
| `GET /api/cron/dri-alerts` | Cron job, `CRON_SECRET`-gated, also manually triggerable from the UI — uncatalogued |
| `GET/PUT /api/admin/dri-config` | Local JSON config file for DRI contacts — **no authentication at all today**, a real pre-existing gap, flagged not fixed |
| `GET /api/admin/migrate-director-roles` | One-time data-migration utility, not part of the Directors CRUD feature |
| Document Vault file serving (`public/uploads/docs/*`) | Static assets — Next.js serves them directly, no route handler exists to attach a permission check to. Authenticated-only via `proxy.ts`'s blanket session gate (same as every route), never permission-checked. `PermissionCodes` intentionally omits `DOCUMENT_DOWNLOAD` as a result, even though the catalog defines `document.download` |

## Phase 5 — Frontend enforcement (partial)

**Shipped:** `components/ui/AccessDenied.tsx` — one reusable component (`message`, optional `requiredPermission`, `backHref`/`backLabel`), used identically by every module listed above. Two detection patterns, chosen per page's actual architecture rather than assumed:
- **Server Component pages** (the majority): `hasPermission()` checked before any data load, `AccessDenied` returned instead of rendering `Promise.all([...])` results.
- **Client-fetch pages** (Users, Roles — architecturally different, pre-existing before this rollout): the initial `fetch()` detects `res.status === 403` and swaps to `AccessDenied` client-side.

**Not shipped, deliberately deferred:** navigation visibility. `components/layout/Sidebar.tsx`'s `PERMISSIONS: Record<UserRole, string[]>` (legacy 5-value enum, module-level, hand-duplicated from `lib/db/users.ts`'s now-deleted `ROLE_PERMISSIONS`) still controls every nav item, unrelated to the real permission set. This was raised during the Dashboard module and decided explicitly: do the Sidebar migration once, for every module at the same time, rather than introducing a one-off permission check for a single module that would create an inconsistent hybrid (part of the sidebar on the new model, part on the old).

## Phase 6 — Testing (partial)

- **Automated:** `lib/auth/permissions.test.ts` (24 tests) covers the authorization engine itself (`hasPermission`/`hasAllPermissions`/`hasAnyPermission`/`requirePermission`/`PermissionError`) in isolation, with Prisma mocked. No automated tests exist for the route-level `authorizeRequest()` wiring across the 15 modules above.
- **Manual:** each module's `403`/`AccessDenied` behavior was spot-checked during its own rollout, primarily using a dedicated zero-permission custom role (`TestRolezz`) kept permanently at 0 permissions specifically as a regression fixture — confirm access denied with no grants, then confirm access unlocks after granting exactly the permission under test, nothing more.

## Known deferred work / technical debt (consolidated)

| Item | Where | Status |
|---|---|---|
| Sidebar navigation migration | `components/layout/Sidebar.tsx` | Deferred — dedicated future task, all modules at once |
| Legacy `ROLE_PERMISSIONS` map | `lib/db/users.ts` | ✅ Removed (dead code, zero remaining references) after the Users page was migrated to read real role/permission data |
| `Sidebar.tsx`'s own duplicate `PERMISSIONS` map | `components/layout/Sidebar.tsx` | Still present — to be removed together with the Sidebar migration above |
| `ComplianceObligation.owner` ownership matching | `app/api/notifications/tasks/route.ts` | Free-text string match against `session.user.name`, not a `User.id` FK. Documented, not fixed — target state is migrating onto the new Notification platform (see `08-notification-platform.md`) |
| `Submission.submittedBy` not a `User.id` FK | `app/api/submissions/route.ts`, `[id]/route.ts` | Fixed to always be session-derived (never client-trusted) as part of RBAC hardening; still a free-text `String`, not a real relation — blocking dependency for further notification integration, documented in `08-notification-platform.md` |
| `Header.tsx` notification-bell readability | `components/layout/Header.tsx` | The `bellItems` merge (two sources, JSX embedded in a data array) was reviewed and flagged as worth a small presentational extraction (`LegacyNotificationItem`/`PlatformNotificationItem`), deliberately deferred until more notification types are live and the bell's shape has settled |
| `document.download` / static file serving | `public/uploads/docs/*` | No enforcement point exists without introducing a proxied download route — an architectural change explicitly out of scope for the Document Vault RBAC pass |

## Files touched — Phase 4/5 rollout (cumulative, by category)

- `lib/auth/permission-codes.ts` — grew incrementally, one module's constants per rollout step; no constant added without a pre-existing seeded `Permission.code`
- `components/ui/AccessDenied.tsx` — added once, reused by every module
- One or more `app/api/**/route.ts` per module — `authorizeRequest()` added as the first statement in each protected handler
- One `app/**/page.tsx` (or the two client-fetch pages' state logic) per module
- `docs/security/01`–`06` — read repeatedly for verification, not modified during the rollout itself
