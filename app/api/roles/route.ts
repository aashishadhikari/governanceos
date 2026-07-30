// GET  /api/roles        — list all roles
// POST /api/roles        — create a role

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Preferred helper for API routes.
// Automatically records the authenticated user,
// client IP address and browser User-Agent.
import { writeRequestAuditLog } from '@/lib/audit';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';

export async function GET() {
  try {
    const denied = await authorizeRequest(PermissionCodes.ROLE_VIEW);
    if (denied) return denied;

    const roles = await prisma.role.findMany({
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        _count: {
          select: { users: true },
        },
        permissions: {
          select: {
            permission: {
              select: {
                code: true,
                name: true,
                description: true,
                module: true,
              },
            },
          },
        },
      },
    });

    const data = roles.map(({ _count, permissions, ...role }) => ({
      ...role,
      userCount: _count.users,
      permissions: permissions.map((rp) => rp.permission),
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error('[GET /api/roles]', err);
    return NextResponse.json(
      { error: 'Failed to fetch roles.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = await authorizeRequest(PermissionCodes.ROLE_CREATE);
    if (denied) return denied;

    const body = await req.json();
    const { name, description, isSystem } = body as {
      name: string;
      description?: string;
      isSystem?: boolean;
    };

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const existingRole = await prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      return NextResponse.json(
        { error: 'A role with this name already exists.' },
        { status: 400 }
      );
    }

    const role = await prisma.role.create({
      data: {
        name,
        description: description ?? null,
        isSystem: isSystem ?? false,
      },
    });

    // Record the role creation in the audit trail.
    // The authenticated administrator is captured automatically.
    await writeRequestAuditLog(req, {
      action: 'CREATE',
      tableName: 'roles',
      recordId: role.id,
      newValues: role,
    });

    return NextResponse.json(role, { status: 201 });
  } catch (err) {
    console.error('[POST /api/roles]', err);
    return NextResponse.json(
      { error: 'Failed to create role' },
      { status: 500 }
    );
  }
}