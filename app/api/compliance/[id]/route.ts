/**
 * PATCH /api/compliance/[id] — update a compliance obligation
 * DELETE /api/compliance/[id] — delete it
 *
 * PATCH body accepts any of: status, submittedDate, completedAt,
 * filingReference, confirmedBy, owner, notes. Passing `status: 'completed'`
 * without an explicit `completedAt` stamps the current time.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Preferred helper for API routes.
// Automatically records the authenticated user,
// client IP address and browser User-Agent.
import { writeRequestAuditLog } from '@/lib/audit';
import { pushStatusToJira } from '@/lib/jiraSync';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const existing = await prisma.complianceObligation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.entityId !== undefined) data.entityId = body.entityId;
    if (body.owner !== undefined) data.owner = body.owner;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.filingReference !== undefined) data.filingReference = body.filingReference;
    if (body.jiraReference !== undefined) data.jiraReference = body.jiraReference;
    if (body.confirmedBy !== undefined) data.confirmedBy = body.confirmedBy;
    if (body.requirementType !== undefined) data.requirementType = body.requirementType;
    if (body.regulator !== undefined) data.regulator = body.regulator;
    if (body.description !== undefined) data.description = body.description;
    if (body.recurrence !== undefined) data.recurrence = body.recurrence;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
    if (body.submittedDate !== undefined) {
      data.submittedDate = body.submittedDate ? new Date(body.submittedDate) : null;
    }
    if (body.completedAt !== undefined) {
      data.completedAt = body.completedAt ? new Date(body.completedAt) : null;
    }

    // If marking complete and no explicit completedAt/submittedDate given, stamp now
    if (body.status === 'completed') {
      if (data.completedAt === undefined) data.completedAt = new Date();
      if (data.submittedDate === undefined && !existing.submittedDate) {
        data.submittedDate = new Date();
      }
    }

    const updated = await prisma.complianceObligation.update({ where: { id }, data });

    // Record the compliance obligation update in the audit trail.
    // The authenticated user is captured automatically.
    await writeRequestAuditLog(request, {
      action: 'UPDATE',
      tableName: 'compliance_obligations',
      recordId: id,
      entityId: existing.entityId,
      oldValues: existing,
      newValues: updated,
    });

    // Push status change to Jira (fire-and-forget; never blocks the response)
    if (body.status && body.status !== existing.status) {
      pushStatusToJira(existing.description, body.status).catch(() => {
        // already logged inside pushStatusToJira
      });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[PATCH /api/compliance/[id]]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const existing = await prisma.complianceObligation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await prisma.complianceObligation.delete({ where: { id } });


    // Record the compliance obligation deletion in the audit trail.
    // The authenticated user is captured automatically.
    await writeRequestAuditLog(request, {
      action: 'DELETE',
      tableName: 'compliance_obligations',
      recordId: id,
      entityId: existing.entityId,
      oldValues: existing,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/compliance/[id]]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 },
    );
  }
}
