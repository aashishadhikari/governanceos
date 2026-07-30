// GET /api/permissions — list the full permission catalog (read-only)

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';

export async function GET() {
  try {
    const denied = await authorizeRequest(PermissionCodes.ROLE_VIEW);
    if (denied) return denied;

    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
      select: {
        code: true,
        name: true,
        description: true,
        module: true,
      },
    });

    return NextResponse.json(permissions);
  } catch (err) {
    console.error('[GET /api/permissions]', err);
    return NextResponse.json(
      { error: 'Failed to fetch permissions.' },
      { status: 500 }
    );
  }
}
