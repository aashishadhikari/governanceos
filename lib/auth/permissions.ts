// RBAC authorization engine — the ONLY place permission logic should live.
// Every future permission-gated check (API route, server action, script,
// etc.) should go through this module rather than re-implementing any part
// of this resolution.
//
// Resolution path (see docs/security/01-rbac-overview.md):
//
//   session.user.roleId -> Role -> RolePermission -> Permission.code
//
// There is no direct User -> Permission assignment; the Role is always the
// sole source of authority. System roles are NOT special-cased anywhere in
// this file — Super Admin, Admin, Legal, Finance, Viewer, and every custom
// role are all just rows with RolePermission assignments, checked the same
// way. No role name is ever hardcoded here.
//
// Deliberately framework-agnostic: no NextResponse, no Next.js imports, no
// request-level caching. This keeps the module usable anywhere a Session is
// available — a route handler, a server action, a script — not just inside
// an HTTP request/response cycle. The HTTP-specific convenience wrapper
// that turns a failed check into a NextResponse lives in lib/auth/session.ts
// instead (see authorizeRequest() there).
//
// This module only introduces the authorization *engine*. Nothing in the
// application calls it yet — wiring it into individual routes is a
// separate, incremental rollout (see docs/security/06-migration-plan.md).

import type { Session } from 'next-auth';
import prisma from '@/lib/prisma';

// Thrown by requirePermission() when the session lacks the permission.
// Framework-agnostic on purpose — callers decide how to turn this into an
// HTTP response, a redirect, a CLI exit code, or anything else.
export class PermissionError extends Error {
  constructor(public permissionCode: string) {
    super(`Missing permission: ${permissionCode}`);
    this.name = 'PermissionError';
  }
}

// One query per call — no caching yet. Every permission check re-resolves
// from the database. This can be memoized later (e.g. per-request) without
// changing any call site, once that's actually needed.
async function getPermissionCodesForRole(roleId: string): Promise<Set<string>> {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { code: true } } },
  });

  return new Set(rows.map((row) => row.permission.code));
}

// A session with no roleId — no database role assigned yet, or no session
// at all — has zero permissions. Deny by default; never assume access.
async function getSessionPermissions(session: Session | null | undefined): Promise<Set<string>> {
  const roleId = session?.user?.roleId;
  if (!roleId) return new Set();
  return getPermissionCodesForRole(roleId);
}

export async function hasPermission(
  session: Session | null | undefined,
  permissionCode: string
): Promise<boolean> {
  const permissions = await getSessionPermissions(session);
  return permissions.has(permissionCode);
}

export async function hasAnyPermission(
  session: Session | null | undefined,
  permissionCodes: string[]
): Promise<boolean> {
  const permissions = await getSessionPermissions(session);
  return permissionCodes.some((code) => permissions.has(code));
}

export async function hasAllPermissions(
  session: Session | null | undefined,
  permissionCodes: string[]
): Promise<boolean> {
  const permissions = await getSessionPermissions(session);
  return permissionCodes.every((code) => permissions.has(code));
}

// Returns normally when permitted; throws PermissionError otherwise.
//
//   await requirePermission(session, 'entity.edit');
//
// For HTTP route handlers, prefer authorizeRequest() in lib/auth/session.ts,
// which wraps this and returns a ready-to-use 403 NextResponse instead of
// requiring every caller to catch PermissionError itself.
export async function requirePermission(
  session: Session | null | undefined,
  permissionCode: string
): Promise<void> {
  if (!(await hasPermission(session, permissionCode))) {
    throw new PermissionError(permissionCode);
  }
}
