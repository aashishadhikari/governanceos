import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Preferred helper for API routes.
// Automatically records the authenticated user,
// client IP address and browser User-Agent.
import { writeRequestAuditLog } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const entityId = searchParams.get('entityId');

    const where: any = {};
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (category) where.category = category;
    if (entityId) where.entityId = entityId;

    let result = await prisma.alert.findMany({
      where,
      include: { entity: true },
    });

    // Sort: unread first, then by severity (critical > warning > info)
    result = result.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const statusOrder = { unread: 0, read: 1, dismissed: 2 };
      const statusDiff = statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder];
      if (statusDiff !== 0) return statusDiff;
      return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
    });

    return NextResponse.json({
      data: result,
      total: result.length,
      unread: result.filter(a => a.status === 'unread').length,
      critical: result.filter(a => a.severity === 'critical').length,
    });
  } catch (err) {
    console.error('[GET /api/alerts]', err);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { alertIds, status } = body;

    if (!alertIds || !Array.isArray(alertIds) || !status) {
      return NextResponse.json(
        { error: 'Missing alertIds or status' },
        { status: 400 }
      );
    }

    const updated = await prisma.alert.updateMany({
      where: { id: { in: alertIds } },
      data: { status },
    });

   
    for (const id of alertIds) {
      // Record the alert status update in the audit trail.
      // The authenticated user is captured automatically.
      await writeRequestAuditLog(request, {
        action: 'UPDATE',
        tableName: 'alerts',
        recordId: id,
        newValues: { status },
      });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[PATCH /api/alerts]', err);
    return NextResponse.json(
      { error: 'Failed to update alerts' },
      { status: 500 }
    );
  }
}
