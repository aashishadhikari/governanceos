import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';

export async function GET() {
  try {
    const denied = await authorizeRequest(PermissionCodes.USER_VIEW);
    if (denied) return denied;

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return NextResponse.json(users);
  } catch (err) {
    console.error('[GET /api/users/active]', err);

    return NextResponse.json(
      { error: 'Failed to fetch active users' },
      { status: 500 }
    );
  }
}