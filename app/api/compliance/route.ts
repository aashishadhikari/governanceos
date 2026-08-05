import { NextResponse } from 'next/server';
import type { Prisma, ComplianceStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
// Preferred helper for API routes.
// Automatically records the authenticated user,
// client IP address and browser User-Agent.
import { writeRequestAuditLog } from '@/lib/audit';
import { authorizeRequest, getAuthSession } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import { createNotification } from '@/lib/notifications/service';
import { resolveUserByEmailOrName } from '@/lib/notifications/resolveRecipient';
import { sendNotificationEmail } from '@/lib/email';

const VALID_STATUSES: ComplianceStatus[] = [
  'pending',
  'submitted',
  'overdue',
  'completed',
  'not_applicable',
];

export async function GET(request: Request) {
  try {
    const denied = await authorizeRequest(PermissionCodes.COMPLIANCE_VIEW);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');
    const status = searchParams.get('status');
    const regulator = searchParams.get('regulator');

    const where: Prisma.ComplianceObligationWhereInput = {};
    if (entityId) where.entityId = entityId;
    if (status && VALID_STATUSES.includes(status as ComplianceStatus)) {
      where.status = status as ComplianceStatus;
    }
    if (regulator) where.regulator = regulator;

    let result = await prisma.complianceObligation.findMany({
      where,
      include: { entity: true },
      orderBy: [
        { status: 'asc' },
        { dueDate: 'asc' },
      ],
    });

    // Sort: overdue first, then by due date
    result = result.sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

    return NextResponse.json({
      data: result,
      total: result.length,
      overdue: result.filter(c => c.status === 'overdue').length,
      pending: result.filter(c => c.status === 'pending').length,
      completed: result.filter(c => c.status === 'completed').length,
    });
  } catch (err) {
    console.error('[GET /api/compliance]', err);
    return NextResponse.json(
      { error: 'Failed to fetch compliance obligations' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const denied = await authorizeRequest(PermissionCodes.COMPLIANCE_CREATE);
    if (denied) return denied;

    const body = await request.json();

    const obligation = await prisma.complianceObligation.create({
      data: {
        entityId: body.entityId,
        requirementType: body.requirementType,
        regulator: body.regulator,
        description: body.description,
        dueDate: new Date(body.dueDate),
        submittedDate: body.submittedDate ? new Date(body.submittedDate) : null,
        owner: body.owner,
        notes: body.notes,
        recurrence: body.recurrence || 'annual',

        filingReference: body.filingReference,
        jiraReference: body.jiraReference,

        // New obligations are always created in Pending status.
        status: 'pending',
        // Indicates the obligation was created manually via the UI.
        source: 'manual',
      },
      include: { entity: true },
    });

    // Record the compliance obligation creation in the audit trail.
    // The authenticated user is captured automatically.
    await writeRequestAuditLog(request, {
      action: 'CREATE',
      tableName: 'compliance_obligations',
      recordId: obligation.id,
      entityId: obligation.entityId,
      newValues: obligation,
    });

    // Notify the owner — best-effort resolution since `owner` is free text,
    // not a User.id FK (same known limitation as Submission.submittedBy).
    // Silently skip if it doesn't resolve to a platform user.
    const recipient = await resolveUserByEmailOrName(obligation.owner);
    if (recipient) {
      const session = await getAuthSession();
      createNotification({
        type: 'TASK_ASSIGNED',
        recipientId: recipient,
        actorId: session?.user?.id ?? null,
        entityType: 'COMPLIANCE_OBLIGATION',
        entityId: obligation.id,
        metadata: { subject: `the "${obligation.requirementType}" obligation`, requirementType: obligation.requirementType },
      }).catch((err) => console.error('[compliance] obligation-assigned notification failed', err));

      const recipientUser = await prisma.user.findUnique({ where: { id: recipient }, select: { name: true, email: true } });
      if (recipientUser) {
        sendNotificationEmail(recipientUser.email, {
          recipientName: recipientUser.name,
          heading: 'New compliance obligation assigned',
          message: `You have been assigned "${obligation.requirementType}" (${obligation.regulator}), due ${obligation.dueDate.toDateString()}.`,
          actionUrl: `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/compliance`,
          actionText: 'Review Obligation',
        }).catch((err) => console.error('[compliance] obligation-assigned email failed', err));
      }
    }

    return NextResponse.json({ data: obligation }, { status: 201 });
  } catch (error) {
  console.error('Compliance POST Error:', error);

  return NextResponse.json(
    {
      error: 'Failed to create compliance obligation.',
    },
    { status: 500 }
  );
}
}
