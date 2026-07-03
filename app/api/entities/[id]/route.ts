import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Preferred helper for API routes.
// Automatically records the authenticated user,
// client IP address and browser User-Agent.
import { writeRequestAuditLog } from '@/lib/audit';

// PATCH /api/entities/[id] — update entity fields in place
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.entity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }


    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ex = existing as any;
    const updated = await (prisma.entity.update as any)({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        status: body.status ?? existing.status,
        registeredAddress: body.registeredAddress ?? existing.registeredAddress,
        governingLaw: body.governingLaw ?? existing.governingLaw,
        auditor: body.auditor ?? existing.auditor,
        regulator: body.regulator ?? existing.regulator,
        financialYearEnd: body.financialYearEnd ?? existing.financialYearEnd,
        incorporationDate: body.incorporationDate !== undefined
          ? (body.incorporationDate ? body.incorporationDate : existing.incorporationDate)
          : existing.incorporationDate,
        legalStructure: body.legalStructure ?? existing.legalStructure,
        purpose: body.purpose ?? ex.purpose,
        formerName: body.formerName ?? ex.formerName,
        regulatorUrl: body.regulatorUrl ?? ex.regulatorUrl,
      },
    });

    // Record the entity update in the audit trail.
    // The authenticated user is captured automatically.
    await writeRequestAuditLog(request, {
      action: 'UPDATE',
      tableName: 'entities',
      recordId: id,
      entityId: id,
      oldValues: existing,
      newValues: updated,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[PATCH /api/entities/:id]', err);
    return NextResponse.json(
      { error: 'Failed to update entity' },
      { status: 500 },
    );
  }
}

// Delete Entity by ID
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check whether the entity exists
    const entity = await prisma.entity.findUnique({
      where: { id },
      include: {
        subsidiaries: {
          select: { id: true },
        },
      },
    });

    if (!entity) {
      return NextResponse.json(
        { error: 'Entity not found.' },
        { status: 404 }
      );
    }

    // Prevent deleting an entity that still has subsidiaries
    if (entity.subsidiaries.length > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete an entity that has subsidiary entities. Remove or reassign the subsidiaries first.',
        },
        { status: 400 }
      );
    }

    await prisma.entity.delete({
      where: { id },
    });

    await writeRequestAuditLog(request, {
      action: 'DELETE',
      tableName: 'entities',
      recordId: id,
      entityId: id,
      oldValues: entity,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error('[DELETE /api/entities/:id]', err);

    return NextResponse.json(
      { error: 'Failed to delete entity.' },
      { status: 500 }
    );
  }
}