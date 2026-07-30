// POST /api/roles/:id/clone — clone an existing role (system or custom) into a new custom role

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

export async function POST(req: NextRequest, { params }: Props) {
  try {
    const denied = await authorizeRequest(PermissionCodes.ROLE_CREATE);
    if (denied) return denied;

    const { id } = await params;
    const body = await req.json();

    const sourceRole = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          select: { permissionId: true },
        },
      },
    });

    if (!sourceRole) {
      return NextResponse.json({ error: 'Source role not found' }, { status: 404 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const duplicate = await prisma.role.findUnique({ where: { name } });
    if (duplicate) {
      return NextResponse.json(
        { error: 'A role with this name already exists.' },
        { status: 400 }
      );
    }

    // Description defaults to the source role's description when omitted —
    // same omission-vs-explicit-value convention as PATCH /api/roles/:id.
    let description: string | null;
    if (!('description' in body)) {
      description = sourceRole.description;
    } else if (typeof body.description === 'string') {
      const trimmed = body.description.trim();
      description = trimmed === '' ? null : trimmed;
    } else {
      description = null;
    }

    // Clone is atomic: create the new role and copy its permission
    // assignments in one transaction, so a clone is never left with only
    // some of the source's permissions if something fails mid-way.
    // isSystem is always false — a cloned role is never a system role,
    // regardless of what it was cloned from. No users are copied.
    const clonedRole = await prisma.$transaction(async (tx) => {
      const newRole = await tx.role.create({
        data: {
          name,
          description,
          isSystem: false,
        },
      });

      if (sourceRole.permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: sourceRole.permissions.map((rp) => ({
            roleId: newRole.id,
            permissionId: rp.permissionId,
          })),
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: newRole.id },
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

    const { _count, permissions, ...roleFields } = clonedRole;
    const result = {
      ...roleFields,
      userCount: _count.users,
      permissions: permissions.map((rp) => rp.permission),
    };

    // Record the clone in the audit trail. `notes` makes the operation type
    // explicit since there's no dedicated CLONE audit action — reusing the
    // existing AuditAction enum rather than extending it for this.
    await writeRequestAuditLog(req, {
      action: 'CREATE',
      tableName: 'roles',
      recordId: result.id,
      notes: 'Role cloned from an existing role',
      newValues: {
        sourceRoleId: sourceRole.id,
        sourceRoleName: sourceRole.name,
        newRoleId: result.id,
        newRoleName: result.name,
        permissionCount: result.permissions.length,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('[POST /api/roles/:id/clone]', err);
    return NextResponse.json(
      { error: 'Failed to clone role' },
      { status: 500 }
    );
  }
}
