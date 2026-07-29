# Enforcement Strategy

**Status:** Describes the intended authorization strategy. Nothing described here as "target" is implemented yet — see `06-migration-plan.md` for sequencing.

## The one rule everything else follows

> **APIs remain the source of truth for authorization.**

Every other layer described below (navigation visibility, action visibility, route protection) exists purely to give users a coherent experience — showing them what they can do so they don't hit a wall of rejected requests. None of it is a security boundary. If a permission check exists only in the UI and not in the API route that performs the mutation, **that permission is not actually enforced.**

This matters concretely for GovernanceOS today: `Sidebar.tsx`'s `PERMISSIONS` map already hides nav items by module, but not a single API route checks the caller's role or permissions before executing a write. Anyone with a valid session (any role) can currently call any API route directly. Closing that gap is the entire point of Phases 4–5 in the migration plan.

## Backend API authorization

**Target design:**

- Every mutating (and, where the data is sensitive, every reading) API route resolves the current session (already available via `getAuthSession()`) and checks that the user's role grants the specific permission the route requires — e.g. `PATCH /api/entities/:id` requires `entity.edit`.
- This check happens **inside the route handler**, layered on top of (not instead of) the existing `proxy.ts` authentication gate. `proxy.ts` answers "is there a valid session at all?"; the route-level check answers "does *this* session's role have *this specific* permission?"
- A missing permission returns `403 Forbidden` with a consistent error shape, matching the existing `{ error: string }` convention already used across every route in this codebase — no new response format.
- Permission checks are a single, shared, reusable helper (analogous to how `writeRequestAuditLog` and `getAuthSession` are already shared) rather than each route reimplementing the check inline — but this is the *only* new shared utility this strategy calls for. No new framework, no per-route decorator system, no new architecture beyond one helper function.
- Every permission-denied attempt is a candidate for audit logging, reusing the existing `AuditLog` model — the specifics of whether every denial is logged (vs. only mutating-route denials) is a Phase 4 implementation decision, not decided here.

## Frontend UI authorization

The UI's job is to **reflect** what the API will allow, not to **decide** it. Concretely:

- Once permissions are resolved for the logged-in user (via their role), the frontend should hold that permission set (e.g. attached to the session, mirroring how `role`/`department`/`title` are already attached to the NextAuth session today) and use it purely for rendering decisions.
- If the UI shows an "Edit" button a user's role doesn't actually have `*.edit` for, and the user clicks it, the resulting API call must still be rejected by the backend check above. The UI being wrong is a bug to fix; it is never treated as the reason a request should have been blocked.

## Navigation visibility

- Sidebar sections/items should be filtered by the user's actual permission set, not a hardcoded per-role module array. This replaces `Sidebar.tsx`'s current `PERMISSIONS` constant with a real check (e.g. "show the Roles nav item if the user has `role.view`") — the mechanism (filtering an array before rendering) doesn't change, only what it filters against does.
- A nav item should require the *view* permission for its module at minimum. A module with zero granted permissions should not appear in navigation at all — there's nothing behind it for that user.

## Action visibility

- Individual buttons/icons within a page (Edit, Delete, Add Role, etc.) should be conditionally rendered based on the specific permission that the action they trigger requires — mirroring the granularity of the permission catalog, not just the module-level nav check.
- Where an action is already guarded server-side today for reasons unrelated to RBAC (e.g. the Delete button being disabled for system roles in `/admin/roles`, because the backend rejects that regardless of who's asking), that guard stays as-is — permission-based hiding is an *additional* layer, not a replacement for existing business-rule guards.

## Route protection

- `proxy.ts` continues to be the first gate: no valid session, no access to anything except `/login` and public auth endpoints — this doesn't change.
- On top of that, page-level route protection (e.g. a user without any Admin-module permission directly navigating to `/admin/roles` by URL) should redirect or show a clear "not authorized" state, rather than rendering a page whose data-fetching calls will simply come back `403` piecemeal. This is a UX improvement layered on top of the backend enforcement in the section above — it does not replace it. Even if this page-level check is skipped or has a bug, the underlying `GET`/`POST`/`PATCH`/`DELETE /api/roles*` calls must independently reject an unpermitted user.

## Summary

| Layer | Purpose | Can it be trusted for security? |
|---|---|---|
| `proxy.ts` | Require a valid session | Yes — already enforced |
| API route permission check | Require the specific permission for the action | **This is the actual boundary** (target, not yet built) |
| Route-level UI redirect | Avoid rendering a page the user can't use | No — UX only |
| Navigation visibility | Don't show entry points to inaccessible modules | No — UX only |
| Action visibility | Don't show buttons for actions the user can't perform | No — UX only |
