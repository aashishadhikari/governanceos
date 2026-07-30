import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Preferred helper for API routes.
// Automatically records the authenticated user,
// client IP address and browser User-Agent.
import { writeRequestAuditLog } from '@/lib/audit';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';

export async function GET(request: Request) {
  try {
    const denied = await authorizeRequest(PermissionCodes.ENTITY_VIEW);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const country = searchParams.get('country');

    const where: any = {};
    if (status) where.status = status;
    if (country) where.country = country;

    const result = await prisma.entity.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        regulatoryCapital: true,
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        subsidiaries: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ data: result, total: result.length });
  } catch (err) {
    console.error('[GET /api/entities]', err);
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const denied = await authorizeRequest(PermissionCodes.ENTITY_CREATE);
    if (denied) return denied;

    const body = await request.json();

    // Validate parent entity (if provided)
    if (body.parentEntityId) {
      const parentEntity = await prisma.entity.findUnique({
        where: {
          id: body.parentEntityId,
        },
        select: {
          id: true,
        },
      });

      if (!parentEntity) {
        return NextResponse.json(
          { error: 'Parent entity not found.' },
          { status: 400 }
        );
      }
    }
    if (!body.financialYearEnd?.trim()) {
      return NextResponse.json(
        { error: 'Financial Year End is required.' },
        { status: 400 }
      );
    }
    const entity = await prisma.entity.create({
      data: {
        name: body.name,
        country: body.country,
        legalStructure: body.legalStructure,
        registrationNumber: body.registrationNumber,
        registeredAddress: body.registeredAddress || null,
        incorporationDate: body.incorporationDate ? new Date(body.incorporationDate) : new Date(),
        financialYearEnd: body.financialYearEnd || null,
        governingLaw: body.governingLaw || null,
        auditor: body.auditor || null,
        parentEntityId: body.parentEntityId || null,
        regulator: body.regulator,
        isLegacyEntity: body.isLegacyEntity || false,
        status: body.status || 'active',
        notes: body.notes || null,
      },
    });

    // Record the entity creation in the audit trail.
    // The authenticated user is captured automatically.
    await writeRequestAuditLog(request, {
      action: 'CREATE',
      tableName: 'entities',
      recordId: entity.id,
      entityId: entity.id,
      newValues: entity,
    });

    return NextResponse.json({ data: entity }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/entities]', err);
    return NextResponse.json(
      { error: 'Failed to create entity' },
      { status: 500 }
    );
  }
}
