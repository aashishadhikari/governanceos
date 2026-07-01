// GET  /api/users        — list all users
// POST /api/users        — create a user

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { writeAuditLog, requestMeta } from '@/lib/audit';
import type { UserRole } from '@prisma/client';
import { createInvitation } from '@/lib/auth/user-token';


export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { email: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
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
    const body = await req.json();
    const {
      name,
      email,
      role,
      department,
      title,
      isActive,
    } = body as {
      name: string;
      email: string;
      role: UserRole;
      department: string;
      title: string;
      isActive: boolean;
    };

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Name, Email, and Role are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,

        // No password yet - user will set it using the invitation link
        passwordHash: null,

        role,

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

    console.log('==========================================');
    console.log('User Invitation');
    console.log(invitationUrl);
    console.log('==========================================');




    const meta = requestMeta(req);
    await writeAuditLog({
      action: 'CREATE',
      tableName: 'users',
      recordId: user.id,
      userId: user.id,
      newValues: user,
      ...meta,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error('[POST /api/users]', err);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
