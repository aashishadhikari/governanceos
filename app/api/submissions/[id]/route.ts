import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Props) {
  const denied = await authorizeRequest(PermissionCodes.SUBMISSION_VIEW);
  if (denied) return denied;

  const { id } = await params;
  try {
    const sub = await (prisma as any).submission.findUnique({ where: { id } });
    if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: sub });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch submission' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Props) {
  const { id } = await params;
  try {
    const body = await request.json();

    // Authorize based on the business action the payload represents, not
    // just "any update" — approve/reject/other-status-transition are each
    // gated by their own permission. Detected from any field associated
    // with that action, not just `status` alone, since the client may
    // send the approval/rejection fields without necessarily including
    // a matching `status` value.
    const isApproval =
      body.status === 'approved' || 'approvedBy' in body || 'approvedAt' in body;
    const isRejection =
      body.status === 'rejected' || 'rejectedBy' in body || 'rejectedAt' in body || 'rejectionNote' in body;

    const requiredPermission = isApproval
      ? PermissionCodes.SUBMISSION_APPROVE
      : isRejection
        ? PermissionCodes.SUBMISSION_REJECT
        : PermissionCodes.SUBMISSION_STATUS_UPDATE;

    const denied = await authorizeRequest(requiredPermission);
    if (denied) return denied;

    const allowed = [
      'status', 'prdContent', 'prdGeneratedAt', 'slackMessageTs',
      'approvedBy', 'approvedAt', 'rejectedBy', 'rejectedAt', 'rejectionNote',
      'implementedAt', 'implementationNote',
    ];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }
    const sub = await (prisma as any).submission.update({ where: { id }, data });
    return NextResponse.json({ data: sub });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
  }
}
