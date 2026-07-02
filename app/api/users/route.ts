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

    // console.log('==========================================');
    // console.log('User Invitation');
    // console.log(invitationUrl);
    // console.log('==========================================');
    try {
      console.log('Sending invitation email...');
      await sendInvitationEmail(
        user.name,
        user.email,
        invitationUrl
      );
      console.log('Invitation email sent.');
    } catch (error) {
      console.error('[POST /api/users] (invitation email)', error);
      console.error('Failed to send invitation email:', error);
    }



    // Record the user creation in the audit trail.
    // recordId identifies the newly created user.
    // The authenticated administrator is captured automatically.
    await writeRequestAuditLog(req, {
      action: 'CREATE',
      tableName: 'users',
      recordId: user.id,
      newValues: user,
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
