# Custom Roles

**Status:** Describes the existing custom-role capability (`/admin/roles`) and how it's expected to be governed once permission assignment exists.

## Why custom roles exist

The five system roles (`03-system-roles.md`) cover common organizational functions, but every customer's org chart and internal responsibilities differ. Custom roles let an administrator define a role that matches how their organization is actually structured — for example, a "Regional Compliance Lead" who needs Compliance and Calendar access scoped to their responsibilities but shouldn't have Regulatory Capital or User Management access.

Custom roles use the exact same `Role` table and the exact same Role Management UI as system roles (`isSystem: false`). There is no separate mechanism, table, or UI for custom vs. system roles — only the `isSystem` flag and the protections it triggers differ.

## How administrators create them

This part is already implemented, unchanged by this document:

1. An administrator with access to `/admin/roles` clicks **Add Role**.
2. `RoleModal` collects a **name** (required, unique, trimmed) and an optional **description**.
3. `POST /api/roles` creates the role with `isSystem: false` (custom roles can never be created as system roles through this flow).
4. The new role immediately becomes selectable when creating or editing a user (`/admin/users`), via the role dropdown that's populated from `GET /api/roles`.

Editing (`PATCH /api/roles/:id`) and deleting (`DELETE /api/roles/:id`) a custom role follow the same rules as any non-system role: duplicate names are rejected, and a role cannot be deleted while any user is still assigned to it.

## How permissions are assigned

**Not yet implemented.** Today, a custom role is just a name and description — it carries no permissions, and a user assigned to a brand-new custom role effectively has no defined access until permission assignment ships (Phase 3, `06-migration-plan.md`).

The intended flow, once built:

1. An administrator opens a role (system or custom) in a **Role Permissions** view.
2. Permissions are presented grouped by module, using the exact structure in `02-permission-catalog.md` (e.g. all `entity.*` permissions grouped under "Entities").
3. The administrator checks/unchecks individual permissions. There is no "select all" that bypasses reviewing what's actually being granted — the goal is deliberate, visible grants, not convenience shortcuts that encourage over-provisioning.
4. Saving writes to the `RolePermission` join table (Phase 2) and is recorded in the audit trail like any other role mutation.

## Governance recommendations

- **Start from the narrowest role that works**, and add permissions only when a real, demonstrated need appears — not preemptively.
- **Name roles by function, not by person.** "Regional Compliance Lead" survives staff turnover; "Jane's Role" doesn't.
- **Avoid role sprawl.** A handful of well-defined custom roles is easier to reason about and audit than dozens of near-duplicate roles created for individual users. If two roles differ by one permission, consider whether that's really a meaningful distinction.
- **Review custom roles periodically**, especially their assigned-user list (`GET /api/roles` already returns `userCount` per role) — a custom role with zero users assigned is a candidate for cleanup.
- **Don't repurpose an existing custom role's meaning.** If a role's actual responsibilities change significantly, prefer creating a new role and migrating users to it over silently redefining what the old role grants — anyone who reads the role name later shouldn't be misled.

## Best practices

- Treat permission assignment changes with the same care as user role changes — both are security-relevant and both are already audited via `AuditLog`; that audit trail should be someone's job to actually review, not just a write-only log.
- Prefer composing a custom role from existing catalog permissions over asking for a new, more powerful permission to be invented for one role's convenience — that pressure is exactly how permission catalogs turn into unmanageable messes.
- Keep the description field meaningful — it's the only place an admin building a user's role dropdown sees context beyond the name (`RoleModal` already surfaces `"{name} — {description}"` in that dropdown).
