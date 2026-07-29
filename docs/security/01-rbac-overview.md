# RBAC Overview

**Status:** Foundational design document — no enforcement exists yet.
**Scope:** GovernanceOS (Corporate Entity Governance platform). This document is the source of truth for how authorization is intended to work across the application, before any permission-checking code is written.

## 1. Why this document exists

GovernanceOS today has:

- A `User` model with a **legacy role enum** (`super_admin`, `admin`, `legal`, `finance`, `viewer`) and a **newer `Role` database table** (`roleId` foreign key), tracked side by side during an in-progress migration.
- A `Role Management` UI (`/admin/roles`) that can already create, edit, and delete custom roles — but a role today is just a **name and description**. It carries no permissions.
- Route-level authentication (`proxy.ts`) that checks "is this user logged in?" — it does **not** check "is this user allowed to do this?"
- Sidebar navigation that hides sections based on a hardcoded per-module array (`PERMISSIONS` in `components/layout/Sidebar.tsx`), not a real permission system.

This document defines the target RBAC model that the rest of the `docs/security/` set builds on. It does not change any of the above — it describes what "done" looks like so implementation (see `06-migration-plan.md`) has a fixed target.

## 2. RBAC architecture

```
User ──(many-to-one)──> Role ──(many-to-many)──> Permission
```

- A **User** is assigned exactly one **Role** (matches the current schema: `User.roleId` is a single nullable foreign key, not a list).
- A **Role** is a named collection of **Permissions**.
- A **Permission** is an atomic, checkable capability — "can do X to Y."
- Authorization decisions are always made by resolving: *this user → their role → the role's permissions → does the required permission exist in that set?*

## 3. Users

- Identity and profile data live on the `User` model (Prisma).
- A user's authorization identity is their assigned `Role` — not their job title, department, or any other attribute.
- A user with no role assigned (`roleId = null`) has **no permissions** and should be treated as unauthorized for any permission-gated action, not defaulted to a permissive role.

## 4. Roles

Two kinds of roles, both stored in the same `Role` table (distinguished by `isSystem`):

- **System roles** — fixed, seeded roles that ship with the product (`03-system-roles.md`). Cannot be deleted (already enforced today by `DELETE /api/roles/:id`) and are not expected to be freely rewired by every customer.
- **Custom roles** — created by administrators for organization-specific needs (`04-custom-roles.md`). Fully governed by the permission set an admin assigns to them.

A role with zero permissions is valid but useless — it should behave identically to having no role at all.

## 5. Permissions

A permission is a string identifier, never a UI label. Permissions are:

- **Atomic** — one permission covers one capability, not a bundle. ("Can edit entities" is one permission, not folded into "can manage entities" alongside delete.)
- **Resource-scoped** — every permission belongs to exactly one resource/module (see `02-permission-catalog.md`).
- **Additive** — a role's effective permissions are the union of whatever's explicitly assigned. There is no "deny" permission; absence of a grant is the only way to withhold access.

## 6. Role–Permission relationship

Many-to-many. A permission (e.g. `entity.delete`) can be granted to multiple roles (`Super Admin`, `Admin`, a custom `Regional Ops Lead` role); a role holds many permissions. This will be implemented as a join table (`RolePermission`) — see `06-migration-plan.md`, Phase 2.

## 7. User–Role relationship

Many-to-one, matching the existing schema. One user, one role, at any given time. Changing a user's role is an administrative action (already implemented: `PATCH /api/users/:id` with `roleId`), fully audited via the existing `AuditLog` (`writeRequestAuditLog`).

## 8. Guiding principles

1. **Deny by default.** No permission, no access. There is no implicit fallback role that grants partial access.
2. **Least privilege.** Roles should be assigned the minimum set of permissions needed for their purpose, not the broadest convenient set.
3. **APIs are the source of truth.** Every enforcement decision must ultimately be made by the backend. UI-level hiding is a convenience, never a security boundary (`05-enforcement-strategy.md`).
4. **System roles are protected, not fine-tuned per tenant.** Their permission sets are defined by GovernanceOS, not edited by end customers, so upgrades don't silently change what "Admin" means.
5. **Everything is auditable.** Role assignment, role creation/edit/deletion, and (once implemented) permission grants must all be recorded in `AuditLog`, reusing the existing `writeRequestAuditLog` helper — no new audit mechanism.
6. **No architecture invented beyond what's needed.** This RBAC design reuses the existing `Role` table, existing audit logging, and existing Prisma/API conventions rather than introducing a new framework.

## 9. Permission naming convention

```
resource.action
```

- `resource` — the noun the permission governs, singular, lowercase (`entity`, `document`, `meeting`).
- `action` — the verb, lowercase (`view`, `create`, `edit`, `delete`, or a more specific verb when a generic CRUD verb doesn't fit, e.g. `upload`, `download`, `generate`, `import`).
- For sub-capabilities of a resource, extend with a dot: `resource.subresource.action` (e.g. `meeting.resolution.create`).

### Examples

```
entity.view
entity.create
entity.edit
entity.delete

document.upload
document.download

meeting.create
meeting.resolution.create
```

The full, authoritative list of permissions is in `02-permission-catalog.md` — this document only defines the *pattern*, not the inventory.
