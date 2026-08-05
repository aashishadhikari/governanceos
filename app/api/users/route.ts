// GET  /api/users        — list all users
// POST /api/users        — create a user

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Preferred helper for API routes.
// Automatically records the authenticated user,
// client IP address and browser User-Agent.
import { writeRequestAuditLog } from '@/lib/audit';
import type { UserRole } from '@prisma/client';
import { createInvitation } from '@/lib/auth/user-token';
import { sendInvitationEmail } from '@/lib/email';
import { Prisma } from '@prisma/client';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';


export async function GET() {
  try {
    const denied = await authorizeRequest(PermissionCodes.USER_VIEW);
    if (denied) return denied;

    const users = await prisma.user.findMany({
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        email: true,

        // Legacy enum (temporary)
        role: true,

        // New database role
        roleId: true,
        roleRef: {
          select: {
            id: true,
            name: true,
            description: true,
            isSystem: true,
          },
        },

        department: true,
        title: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(users);
  } catch (err) {
    console.error('[GET /api/users]', err);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = await authorizeRequest(PermissionCodes.USER_CREATE);
    if (denied) return denied;

    const body = await req.json();
    const {
      name,
      email,
      roleId,
      role,
      department,
      title,
      isActive,
    } = body as {
      name: string;
      email: string;

      // New RBAC role identifier
      roleId?: string;

      // Legacy enum retained until permission-based authorization replaces role checks.
      role: UserRole;

      department: string;
      title: string;
      isActive: boolean;
    };

    if (!name || !email || (!role && !roleId)) {
      return NextResponse.json(
        { error: 'Name, Email, and Role are required' },
        { status: 400 }
      );
    }
    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: 'A user with this email address already exists.',
        },
        {
          status: 400,
        }
      );
    }

    // Resolve the selected database role.
    // During the RBAC migration we continue storing the legacy enum alongside roleId.
    let resolvedRole = role;
    let resolvedRoleId = roleId ?? null;

    if (roleId) {
      const dbRole = await prisma.role.findUnique({
        where: { id: roleId },
      });

      if (!dbRole) {
        return NextResponse.json(
          { error: 'Invalid role selected.' },
          { status: 400 }
        );
      }

      resolvedRoleId = dbRole.id;

      const roleMap: Record<string, UserRole> = {
        'Super Admin': 'super_admin',
        'Admin': 'admin',
        'Legal': 'legal',
        'Finance': 'finance',
        'Viewer': 'viewer',
      };

      resolvedRole = roleMap[dbRole.name];

      if (!resolvedRole) {
        return NextResponse.json(
          { error: 'Selected role is not mapped to a system role.' },
          { status: 400 }
        );
      }
    }
    const user = await prisma.user.create({
      data: {
        name,
        email,

        // No password yet - user will set it using the invitation link
        passwordHash: null,

        // Store both the database role and the legacy enum during the RBAC migration.
        role: resolvedRole,
        roleId: resolvedRoleId,

        department: department ?? '',
        title: title ?? '',

        isActive: isActive ?? true,

        // Keep this for now. We'll remove it after the invitation flow is complete.
        mustChangePassword: true,

        failedLoginAttempts: 0,
      },
    });

    // Create an invitation token for the user
    const invitation = await createInvitation(user.id);
    const invitationUrl =
      `http://localhost:3000/setup-password?token=${invitation.token}`;

    try {
      await sendInvitationEmail(
        user.name,
        user.email,
        invitationUrl
      );
    } catch (error) {
      console.error('[POST /api/users] (invitation email)', error);
      console.error('Failed to send invitation email:', error);
    }



    // Record the user creation in the audit trail.
    // recordId identifies the newly created user.
    // The authenticated administrator is captured automatically.
    // passwordHash is stripped before this ever reaches the audit log or the
    // response body — it must never leave the server, logged or not.
    const { passwordHash: _omitPasswordHash, ...userSafe } = user;

    await writeRequestAuditLog(req, {
      action: 'CREATE',
      tableName: 'users',
      recordId: user.id,
      newValues: userSafe,
    });

    return NextResponse.json(userSafe, { status: 201 });
  } catch (err) {
    console.error('[POST /api/users]', err);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
