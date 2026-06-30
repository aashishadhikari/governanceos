// GET  /api/users        — list all users
// POST /api/users        — create a user

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { writeAuditLog, requestMeta } from '@/lib/audit';
import type { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';


function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }

  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }

  return null;
}

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
      password,
      isActive,
      mustChangePassword,
    } = body as {
      name: string;
      email: string;
      role: UserRole;
      department: string;
      title: string;
      password: string;
      isActive: boolean;
      mustChangePassword: boolean;
    };

    if (!name || !email || !role || !password) {
      return NextResponse.json(
        { error: 'Name, Email, Role, and Password are required' },
        { status: 400 }
      );
    }
    const passwordError = validatePassword(password);

    if (passwordError) {
      return NextResponse.json(
        { error: passwordError },
        { status: 400 }
      );
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,

        role,

        department: department ?? '',
        title: title ?? '',

        isActive: isActive ?? true,
        mustChangePassword: mustChangePassword ?? true,

        failedLoginAttempts: 0,
      },
    });

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
