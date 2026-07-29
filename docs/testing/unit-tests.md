# Unit Test Log

**Status:** Living document. Each time a new unit test suite is added to the project, append a new dated section below rather than editing prior entries — this file is a running record of what's covered, not a snapshot that gets rewritten.

## How to run the suite

```
npm test
```

Runs `vitest run` — all `*.test.ts` files in the project, once, non-watch. Config: `vitest.config.ts` (Node environment, mirrors the project's `@/*` path alias from `tsconfig.json`).

## Conventions

- **Framework:** [Vitest](https://vitest.dev/) — chosen because this project had no test framework installed at all prior to the first suite below, and Vitest needs no additional transform configuration for this TypeScript/ESM codebase.
- **File location:** tests are colocated next to the file they cover, named `<file>.test.ts` (e.g. `lib/auth/permissions.ts` → `lib/auth/permissions.test.ts`). No separate `__tests__/` tree.
- **Mocking:** external dependencies (Prisma, network calls, etc.) are mocked with `vi.mock()`. Tests never connect to a real database or make real HTTP calls — they must be deterministic and fast.
- **Scope:** unit tests target pure logic (library/helper modules). API route handlers, UI components, and database CRUD behavior are exercised through other means (manual verification, the `/verify` workflow), not this suite.

---

## 2026-07-29 — RBAC Authorization Layer

**Files under test:** `lib/auth/permissions.ts`
**Test file:** `lib/auth/permissions.test.ts`
**Result:** ✅ 24/24 passing

### Why

Before wiring `authorizeRequest()`/`requirePermission()` into any real API route (module-by-module enforcement rollout, see `docs/security/06-migration-plan.md` Phase 4), the authorization engine itself needed a regression-catching test suite — enforcement changes are much lower-risk to review once the underlying logic is independently verified.

### What's covered

| Function | Scenarios |
|---|---|
| Session handling | Null session → no permissions, no DB query. Session without `roleId` → no permissions, no DB query. Valid session with `roleId` → queries `rolePermission.findMany` with the correct `roleId`. |
| Permission resolution | Role with zero permissions. Role with one permission. Role with multiple permissions (checking several codes against the same resolved set). An unknown/nonexistent permission code. |
| `hasPermission()` | Returns `true` when the code is granted, `false` when it isn't. |
| `hasAnyPermission()` | `true` when any requested code matches, `false` when none match, and the empty-array case is explicitly documented and tested as vacuously `false` (no code in an empty list can match). |
| `hasAllPermissions()` | `true` when every requested code matches, `false` when one is missing, and the empty-array case is explicitly documented and tested as vacuously `true` (no required codes are left unsatisfied). |
| `requirePermission()` | Resolves silently when authorized; throws `PermissionError` when not, including for a null session. |
| `PermissionError` | Carries the correct `permissionCode`, has the correct `message`, preserves `instanceof PermissionError`/`instanceof Error`, and is confirmed to be the actual type `requirePermission()` throws (not just independently constructible). |

### Mocking approach

Only `prisma.rolePermission.findMany` is mocked (the single Prisma call `permissions.ts` makes) via `vi.mock('@/lib/prisma', ...)`. Since caching was deliberately not introduced in this phase, each permission check is an independent database call by design — the mock uses `mockResolvedValue` (persists across calls within a test) rather than `mockResolvedValueOnce`, matching that reality; the earlier draft of this suite used `-Once` and failed for exactly this reason (a multi-check test only had one queued response), corrected before landing.

### Production code changes

None. `lib/auth/permissions.ts` and `lib/auth/session.ts` were already framework-agnostic and testable in isolation; no refactor was needed to write this suite.

### Confirms

- Authorization enforcement has **not** begun anywhere in the application — nothing outside `lib/auth/permissions.ts`/`lib/auth/session.ts`/this test file references these functions yet.
- No runtime behavior changed; only `package.json` gained the `vitest` devDependency and a `test` script.

---

<!--
Template for the next entry — copy this block below the divider above when
a new suite is added:

## YYYY-MM-DD — <Suite name>

**Files under test:** <path(s)>
**Test file:** <path(s)>
**Result:** ✅/❌ <passed>/<total>

### Why

### What's covered

### Mocking approach

### Production code changes

### Confirms
-->
