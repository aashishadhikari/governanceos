# System Roles

**Status:** Describes the built-in roles as they exist today. This document intentionally stops at high-level access — fine-grained permission assignments (per `02-permission-catalog.md`) are Phase 3 work (`06-migration-plan.md`) and are not decided here.

System roles are seeded via `scripts/seed-roles.ts` and marked `isSystem: true` in the `Role` table, which means they cannot be deleted through the Role Management UI or API (`DELETE /api/roles/:id` rejects deletion of any role with `isSystem: true`).

## Current system roles

- Super Admin
- Admin
- Legal
- Finance
- Viewer

These correspond 1:1 to the legacy `UserRole` enum (`super_admin`, `admin`, `legal`, `finance`, `viewer`) that the platform is migrating away from toward the database-backed `Role` table.

---

### Super Admin

**Purpose:** Full operational and administrative control of the platform, including user and role administration.

**Typical users:** Platform owners, IT/security administrators, or a small number of trusted executives who need to manage the system itself, not just entity data.

**High-level access:** Every module, including User Management and Role Management.

### Admin

**Purpose:** Day-to-day administrative operation of the entity governance platform.

**Typical users:** Operations leads or governance team managers responsible for running the platform for their organization.

**High-level access:** Every module, including User Management and Role Management.

> **Note — current state, not intended end state:** Today, Super Admin and Admin have **identical** module-level access (see `PERMISSIONS` in `components/layout/Sidebar.tsx` — both map to the same module list). This is a real gap in the current design, not an oversight in this document. Once fine-grained permissions exist (Phase 3/4), these two roles are expected to diverge — most plausibly by restricting Admin's ability to manage other Admins or platform-level configuration, while Super Admin retains unrestricted access. That decision is out of scope for this document and should be made when the permission catalog is actually assigned to roles.

### Legal

**Purpose:** Manage legal-entity and governance-related data — the records a legal/compliance function is directly responsible for.

**Typical users:** In-house counsel, corporate secretaries, governance officers.

**High-level access:** Entities, Governance Team, Board Meetings, Compliance, Licenses, Alerts, Document Vault. No access to Regulatory Capital or platform administration (Users/Roles).

### Finance

**Purpose:** Manage regulatory capital and financial compliance obligations.

**Typical users:** Finance controllers, treasury, regulatory capital analysts.

**High-level access:** Entities (read context), Compliance, Regulatory Capital, Alerts. No access to Governance Team, Board Meetings, Licenses, Document Vault, or platform administration.

### Viewer

**Purpose:** Read-only visibility into entity governance data, for stakeholders who need information but shouldn't change it.

**Typical users:** Board members, auditors, external counsel given limited access, or internal stakeholders who need reporting visibility only.

**High-level access:** Entities, Governance Team, Compliance, Licenses — all intended to be read-only once fine-grained permissions are enforced. (Today, "Viewer" having any module in its list only controls *navigation visibility*, not whether the underlying API would reject a write — that gap is exactly what `05-enforcement-strategy.md` and Phase 4 of the migration plan exist to close.)
