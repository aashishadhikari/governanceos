// GET    /api/users/:id  — get user
// PATCH  /api/users/:id  — update user
// DELETE /api/users/:id  — deactivate user (soft delete)

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

export async function GET(_req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err) {
    console.error('[GET /api/users/:id]', err);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Props) {
  try {
    const denied = await authorizeRequest(PermissionCodes.USER_EDIT);
    if (denied) return denied;

    const { id } = await params;
    const body = await req.json();
    // Resolve the selected database role into the legacy enum
    if (body.roleId) {
      const role = await prisma.role.findUnique({
        where: { id: body.roleId },
      });

      if (!role) {
        return NextResponse.json(
          { error: "Invalid role selected" },
          { status: 400 }
        );
      }

      body.role =
        role.name === "Super Admin"
          ? "super_admin"
          : role.name === "Admin"
            ? "admin"
            : role.name === "Finance"
              ? "finance"
              : role.name === "Legal"
                ? "legal"
                : "viewer";
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: body,
    });

    // Record the update in the audit trail.
    // recordId identifies the target user being modified.
    // The authenticated user (actor) is captured automatically.
    await writeRequestAuditLog(req, {
      action: 'UPDATE',
      tableName: 'users',
      recordId: id,
      oldValues: user,
      newValues: updated,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PATCH /api/users/:id]', err);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// Record the user deactivation in the audit trail.
// recordId identifies the target user.
// The authenticated user (actor) is captured automatically.
export async function DELETE(req: NextRequest, { params }: Props) {
  try {
    const denied = await authorizeRequest(PermissionCodes.USER_DEACTIVATE);
    if (denied) return denied;

    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    // Record the deactivation in the audit trail.
    // The authenticated administrator is recorded automatically.
    await writeRequestAuditLog(req, {
      action: 'DEACTIVATE',
      tableName: 'users',
      recordId: id,
      oldValues: { isActive: user.isActive },
      newValues: { isActive: false },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (err) {
    console.error('[DELETE /api/users/:id]', err);
    return NextResponse.json(
      { error: 'Failed to deactivate user' },
      { status: 500 }
    );
  }
}
