/**
 * DELETE /api/compliance/clear
 *
 * Deletes ALL compliance obligations from the database.
 * Used to reset before a clean re-import.
 * Requires ?confirm=yes as a safety guard.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';

export async function DELETE(req: NextRequest) {
  const denied = await authorizeRequest(PermissionCodes.COMPLIANCE_CLEAR);
  if (denied) return denied;

  if (req.nextUrl.searchParams.get('confirm') !== 'yes') {
    return NextResponse.json(
      { error: 'Add ?confirm=yes to confirm deletion of all compliance obligations.' },
      { status: 400 },
    );
  }

  const { count } = await prisma.complianceObligation.deleteMany({});
  return NextResponse.json({ deleted: count });
}
