import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeRequest, getAuthSession } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import { createNotification } from '@/lib/notifications/service';

// Best-available mapping for the MVP: Submission.submittedBy is a
// free-text String, not a User.id FK (flagged as a known limitation —
// see the notification-platform architecture discussion). Submissions
// created after the RBAC fix always store a real email, so this resolves
// correctly going forward; older rows (pre-fix hardcoded values, or
// team-name strings) may not resolve to any user, in which case no
// notification is created rather than guessing. A future phase will
// migrate Submissions to a proper User relationship.
async function resolveSubmitterId(submittedBy: string): Promise<string | null> {
  const byEmail = await prisma.user.findUnique({ where: { email: submittedBy }, select: { id: true } });
  if (byEmail) return byEmail.id;

  const byName = await prisma.user.findFirst({ where: { name: submittedBy }, select: { id: true } });
  return byName?.id ?? null;
}

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

    const existing = await (prisma as any).submission.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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

    // Notify the submitter only if the persisted status actually changed —
    // compare the two committed rows, not the incoming request payload, so
    // e.g. an approved -> approved no-op never generates a notification.
    if (sub.status !== existing.status) {
      const recipientId = await resolveSubmitterId(existing.submittedBy);
      if (recipientId) {
        const session = await getAuthSession();
        createNotification({
          type: 'SUBMISSION_STATUS_CHANGED',
          recipientId,
          actorId: session?.user?.id ?? null,
          entityType: 'SUBMISSION',
          entityId: sub.id,
          metadata: { submissionTitle: sub.title, oldStatus: existing.status, newStatus: sub.status },
        }).catch((err) => console.error('[submissions] notification failed', err));
      }
    }

    return NextResponse.json({ data: sub });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
  }
}
