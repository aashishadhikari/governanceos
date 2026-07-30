# Migration Plan

**Status:** Implementation roadmap. This document describes the *plan*, unchanged from when it was written — for what has actually been built, see `07-implementation-log.md`, which is now current: **Phases 1–5 are complete, Phase 6 is partial (engine unit tests exist, per-route coverage was manual).** Each phase was still its own set of changes, reviewed and merged independently, module by module for Phase 4, in a single atomic pass for the Phase 5 Sidebar migration, consistent with this project's "one feature at a time" rule.

## Phase 1 — Permission catalog ✅ Done

**Deliverable:** `02-permission-catalog.md` (this document set).

- Inventory every existing capability across all 14 modules.
- Establish the `resource.action` naming convention (`01-rbac-overview.md`).
- No code changes. This phase is complete as of this document set.

## Phase 2 — Database schema ✅ Done

**Deliverable:** A `Permission` model and a `RolePermission` join table, added via Prisma migration.

- `Permission`: `id`, `key` (the `resource.action` string, unique), `description`.
- `RolePermission`: join table between `Role` and `Permission` (many-to-many), following this project's existing migration conventions (see `prisma/migrations/`).
- Seed the `Permission` table from the Phase 1 catalog, the same way system roles are already seeded (`scripts/seed-roles.ts`).
- Do **not** seed `RolePermission` rows for every system role yet — deciding exactly what Super Admin/Admin/Legal/Finance/Viewer are each granted is a deliberate product decision (flagged as open in `03-system-roles.md`), not something to default silently during a schema migration.
- No behavior change yet — the tables exist, but nothing reads them.

## Phase 3 — Role-Permission UI ✅ Done

**Deliverable:** A way for administrators to view and assign permissions to a role.

- Extend the existing Role Management page (`/admin/roles`) — most likely a permissions view reached from editing a role, following the same modal/page patterns already established (`RoleModal`, `Modal`, `FormField`), not a new UI framework.
- Permissions grouped by module, matching the catalog's structure exactly, so the UI never drifts from the documented inventory.
- At the end of this phase, permissions can be assigned and stored, but still enforce nothing — this is intentionally decoupled from Phase 4 so the data can be populated (and reviewed) before it starts controlling access.

## Phase 4 — API enforcement ✅ Done (see `07-implementation-log.md` for the full per-module table)

**Deliverable:** Every API route checks the caller's permissions before acting, per `05-enforcement-strategy.md`.

- Build the single shared permission-check helper described in the enforcement strategy.
- Apply it route by route, module by module — following the "minimum number of changes per feature" rule already established for this codebase, rather than one sweeping cross-cutting change.
- Suggested order: start with the highest-risk write paths (Users, Roles) before extending to the rest of the catalog, since a mistake there has the widest blast radius.
- This is the phase where the system actually becomes secure. Everything before it is preparation; everything is still fully open (any authenticated user can call any route) until this phase ships.

## Phase 5 — Frontend enforcement 🟡 Partial

**Deliverable:** Navigation, action visibility, and route-level UX reflect the real permission set, per `05-enforcement-strategy.md`.

**Shipped:** route-level UX (`AccessDenied`, both the Server Component and client-fetch-403 patterns). **Not shipped:** navigation and action visibility — deliberately deferred as a single future task covering every module's nav item at once, rather than migrating them one at a time and leaving the Sidebar in a mixed legacy/real-permission state in the meantime.

- Replace `Sidebar.tsx`'s hardcoded `PERMISSIONS` module array with real permission checks.
- Update per-page action buttons (Edit/Delete/Add/etc. across every module) to check the specific permission for that action, not just "is this role generically allowed in this module."
- Add a not-authorized UX for direct navigation to a page the user's role doesn't grant access to.
- This phase should ship *after* Phase 4, not before — hiding a button before the API actually rejects the underlying request would create a false sense of security.

## Phase 6 — Testing 🟡 Partial

**Deliverable:** Confidence that enforcement actually works, and stays working.

- Per-permission tests: for a representative sample of routes, verify a user without the required permission is rejected (`403`) and a user with it succeeds.
- Regression tests for system-role behavior: confirm system roles can't be deleted, and (once Phase 2 assigns them permissions) that their permission sets match what was decided.
- Regression tests for the existing, already-shipped guards that predate this RBAC work (e.g. the system-role and assigned-user delete guards on `DELETE /api/roles/:id`) — these must keep working unchanged as permission checks are layered on top.
- Manual QA checklist covering: navigation visibility per role, action visibility per role, and confirming the backend still rejects a direct API call even when the UI never renders the corresponding button (this is the single most important test — verifying the API is genuinely the enforcement point, not the UI).

## Sequencing summary

| Phase | Depends on | Changes behavior for end users? | Status |
|---|---|---|---|
| 1. Permission catalog | — | No | ✅ Done |
| 2. Database schema | 1 | No | ✅ Done |
| 3. Role-Permission UI | 2 | No (data entry only) | ✅ Done |
| 4. API enforcement | 2, 3 | **Yes — this is where access actually starts being restricted** | ✅ Done |
| 5. Frontend enforcement | 4 | Yes (UX reflects Phase 4's reality) | 🟡 Partial — `AccessDenied` shipped, navigation deferred |
| 6. Testing | All | No (validates the above) | 🟡 Partial — engine unit-tested, routes manually verified |
