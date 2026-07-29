// PATCH  /api/roles/:id  — update role
// DELETE /api/roles/:id  — delete role

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Preferred helper for API routes.
// Automatically records:
// - authenticated user
// - client IP address
// - browser User-Agent
import { writeRequestAuditLog } from '@/lib/audit';

interface Props { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const body = await req.json();

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Description is optional per-request: omitting it preserves the
    // existing value, while providing it (even as an empty string) sets it.
    let description: string | null;
    if (!('description' in body)) {
      description = role.description;
    } else if (typeof body.description === 'string') {
      const trimmed = body.description.trim();
      description = trimmed === '' ? null : trimmed;
    } else {
      description = null;
    }

    const duplicate = await prisma.role.findFirst({
      where: {
        name,
        id: { not: id },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'A role with this name already exists.' },
        { status: 400 }
      );
    }

    // Explicit update object — only name/description are ever writable here.
    // id and isSystem are never accepted from the request body.
    const updated = await prisma.role.update({
      where: { id },
      data: {
        name,
        description,
      },
    });

    // Record the update in the audit trail.
    // recordId identifies the target role being modified.
    // The authenticated user (actor) is captured automatically.
    await writeRequestAuditLog(req, {
      action: 'UPDATE',
      tableName: 'roles',
      recordId: id,
      oldValues: role,
      newValues: updated,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PATCH /api/roles/:id]', err);
    return NextResponse.json(
      { error: 'Failed to update role' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;

    // Validation and delete run inside a single transaction so that the
    // isSystem/assigned-users checks and the delete itself are read and
    // executed against the same transaction rather than as two separate
    // round trips.
    const result = await prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({
        where: { id },
        include: {
          _count: {
            select: { users: true },
          },
        },
      });

      if (!role) {
        return { status: 404 as const, error: 'Role not found' };
      }

      if (role.isSystem) {
        return { status: 400 as const, error: 'Cannot delete system role.' };
      }

      if (role._count.users > 0) {
        return { status: 400 as const, error: 'Role is assigned to users.' };
      }

      await tx.role.delete({ where: { id } });

      return { status: 200 as const, role };
    });

    if (result.status !== 200) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Record the deletion in the audit trail.
    // The authenticated administrator is recorded automatically.
    await writeRequestAuditLog(req, {
      action: 'DELETE',
      tableName: 'roles',
      recordId: id,
      oldValues: result.role,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/roles/:id]', err);
    return NextResponse.json(
      { error: 'Failed to delete role' },
      { status: 500 }
    );
  }
}
