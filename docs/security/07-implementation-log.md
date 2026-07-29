# RBAC Implementation Log

**Status:** Living document. Tracks what has actually been built against the roadmap in `06-migration-plan.md`, as it happens — updated incrementally as each phase ships, not written up-front. This is the factual record of *what exists in the codebase today*; `01`–`06` describe the *design*.

> **Pending addition:** once roles + permissions are fully implemented (through Phase 5/6 of `06-migration-plan.md`), this document will be updated with an entity-relationship diagram, process-flow diagrams (permission resolution at request time, role/permission assignment flow), and a consolidated before/after summary of every database change made across all phases. Those are intentionally not included yet — they'd describe a system that doesn't fully exist yet.

## Migration plan status

| Phase | Description | Status |
|---|---|---|
| 1 | Permission catalog | ✅ Done |
| 2 | Database schema | ✅ Done |
| 3 | Role-Permission UI | ⬜ Not started |
| 4 | API enforcement | ⬜ Not started |
| 5 | Frontend enforcement | ⬜ Not started |
| 6 | Testing | ⬜ Not started |

**As of this document, nothing enforces permissions.** Every user with a valid session can still call every API route, exactly as before this work started. Phases 1–2 built the data foundation only.

## Phase 1 — Permission catalog

- Documented in `02-permission-catalog.md`: 53 permissions across all 14 existing modules, following the `resource.action` naming convention (`01-rbac-overview.md`).
- No code changes in this phase — inventory only.

## Phase 2 — Database schema

**Schema changes** (`prisma/schema.prisma`):

- Added `Permission` model — `id`, `code` (unique), `name`, `description`, `module`, `createdAt`, `updatedAt`. Indexed on `module`.
- Added `RolePermission` model — explicit join table between `Role` and `Permission`, with its own `id`, `roleId`, `permissionId`, `createdAt`. Composite unique constraint on `(roleId, permissionId)`. Both foreign keys cascade on delete.
- Added `Role.permissions RolePermission[]` — the only change to an existing model. Nothing else on `Role`, `User`, or any other model was touched.

**Migration:** `prisma/migrations/20260729075429_add_permission_and_role_permission/` — purely additive (two new tables, three new indexes, two new foreign keys; no existing table, column, or constraint altered or dropped).

**Seed scripts** (both standalone, mirroring the existing `scripts/seed-roles.ts` convention — not part of the main `prisma/seed.ts` data import pipeline):

- `scripts/seed-permissions.ts` — seeds all 53 permissions from the catalog, upserting on `code`. Idempotent.
- `scripts/seed-role-permissions.ts` — assigns permission sets to the five built-in system roles by resolving `role.name` and `permission.module`/`code` dynamically (no hardcoded IDs). Idempotent (upserts on the `(roleId, permissionId)` composite key). Never touches custom roles.

**Seeded data, as verified:**

| Role | Permissions assigned | Basis |
|---|---:|---|
| Super Admin | 53 | All permissions |
| Admin | 53 | All permissions (no `platform.*` permissions exist yet to exclude — see `03-system-roles.md`) |
| Legal | 31 | Dashboard, Entities, Org Chart, Governance Team, Board Meetings, Calendar, Compliance, Licenses, Document Vault |
| Finance | 20 | Dashboard, Regulatory Capital, Compliance, Document Vault, Alerts, Calendar |
| Viewer | 14 | Every `*.view` permission only (one per module) |

**Total `RolePermission` rows: 171.**

Verified via re-running both seed scripts twice: identical counts both times, confirming idempotency. Confirmed the one pre-existing custom role (`DocumentVault`, `isSystem: false`) has 0 permissions and 0 users — untouched by either seed script, since both only ever query/write the five named system roles.

## Files touched so far (Phases 1–2)

- `docs/security/01-rbac-overview.md` through `06-migration-plan.md` (Phase 1)
- `prisma/schema.prisma` (Phase 2)
- `prisma/migrations/20260729075429_add_permission_and_role_permission/migration.sql` (Phase 2)
- `scripts/seed-permissions.ts` (Phase 2)
- `scripts/seed-role-permissions.ts` (Phase 2)
- `docs/security/07-implementation-log.md` (this file)

No UI component, API route, authentication logic, or navigation file has been modified at any point in Phases 1–2.
