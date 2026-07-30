// PATCH /api/roles/:id/permissions — replace a custom role's permission set

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Preferred helper for API routes.
// Automatically records:
// - authenticated user
// - client IP address
// - browser User-Agent
import { writeRequestAuditLog } from '@/lib/audit';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';

interface Props { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Props) {
  try {
    const denied = await authorizeRequest(PermissionCodes.ROLE_EDIT);
    if (denied) return denied;

    const { id } = await params;
    const body = await req.json();

    const permissionCodes = body.permissionCodes;
    if (!Array.isArray(permissionCodes) || !permissionCodes.every((c: unknown) => typeof c === 'string')) {
      return NextResponse.json(
        { error: 'permissionCodes must be an array of permission code strings.' },
        { status: 400 }
      );
    }

    const uniqueCodes = new Set<string>(permissionCodes);
    if (uniqueCodes.size !== permissionCodes.length) {
      return NextResponse.json(
        { error: 'Duplicate permission codes are not allowed.' },
        { status: 400 }
      );
    }

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          select: { permission: { select: { code: true } } },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (role.isSystem) {
      return NextResponse.json(
        { error: 'Cannot edit permissions for a system role.' },
        { status: 400 }
      );
    }

    // Empty permission list is allowed — it just means "revoke everything".
    const codes = [...uniqueCodes];
    const permissions = codes.length > 0
      ? await prisma.permission.findMany({ where: { code: { in: codes } } })
      : [];

    if (permissions.length !== codes.length) {
      const found = new Set(permissions.map((p) => p.code));
      const missing = codes.filter((c) => !found.has(c));
      return NextResponse.json(
        { error: `Unknown permission code(s): ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const beforePermissions = role.permissions.map((rp) => rp.permission.code).sort();

    // Full replace, atomically: clear the role's existing permission set and
    // insert the new one in a single transaction, so a role is never left
    // with a partial permission set if something fails mid-way. Re-reading
    // the role (with its permissions) inside the same transaction returns
    // the resource's actual committed state, not just a bare success flag.
    const updatedRole = await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          isSystem: true,
          _count: { select: { users: true } },
          permissions: {
            select: {
              permission: {
                select: { code: true, name: true, description: true, module: true },
              },
            },
          },
        },
      });
    });

    const { _count, permissions: rolePermissions, ...roleFields } = updatedRole;
    const result = {
      ...roleFields,
      userCount: _count.users,
      permissions: rolePermissions.map((rp) => rp.permission),
    };

    const afterPermissions = result.permissions.map((p) => p.code).sort();

    // Record the permission-set change in the audit trail.
    // recordId identifies the role whose permissions were modified.
    // The authenticated administrator is captured automatically.
    // Codes (not internal IDs) are stored so a future audit report can show
    // exactly which permissions were granted or revoked in plain terms.
    await writeRequestAuditLog(req, {
      action: 'UPDATE',
      tableName: 'role_permissions',
      recordId: id,
      oldValues: { beforePermissions },
      newValues: { afterPermissions },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[PATCH /api/roles/:id/permissions]', err);
    return NextResponse.json(
      { error: 'Failed to update role permissions' },
      { status: 500 }
    );
  }
}
