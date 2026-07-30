import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Preferred helper for API routes.
// Automatically records the authenticated user,
// client IP address and browser User-Agent.
import { writeRequestAuditLog } from '@/lib/audit';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';

// POST /api/board-meetings — schedule a new meeting (or save as draft)
export async function POST(request: Request) {
  try {
    const denied = await authorizeRequest(PermissionCodes.MEETING_CREATE);
    if (denied) return denied;

    const body = await request.json();

    const meeting = await prisma.boardMeeting.create({
      data: {
        entityId: body.entityId,
        meetingType: body.meetingType ?? 'Board Meeting',
        meetingDate: new Date(body.meetingDate),
        meetingTime: body.meetingTime ?? '10:00',
        timezone: body.timezone ?? 'Asia/Singapore',
        locationType: body.locationType ?? 'virtual',
        location: body.location || null,
        virtualLink: body.virtualLink || null,
        chair: body.chair,
        quorumRequired: body.quorumRequired ?? 3,
        agenda: body.agenda,
        recurrence: body.recurrence ?? 'none',
        status: body.asDraft ? 'draft' : 'scheduled',
        createdBy: body.createdBy ?? 'system',
        notes: body.notes || null,
      },
    });

    // Create attendee rows for each invited director
    if (Array.isArray(body.invitedDirectors) && body.invitedDirectors.length > 0) {
      await prisma.meetingAttendee.createMany({
        data: body.invitedDirectors.map((directorId: string) => ({
          meetingId: meeting.id,
          directorId,
          status: 'invited',
        })),
        skipDuplicates: true,
      });
    }


    // Record the board meeting creation in the audit trail.
    // The authenticated user is captured automatically.
    await writeRequestAuditLog(request, {
      action: 'CREATE',
      tableName: 'board_meetings',
      recordId: meeting.id,
      entityId: meeting.entityId,
      newValues: meeting,
    });

    return NextResponse.json({ data: meeting }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/board-meetings]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create meeting' },
      { status: 500 },
    );
  }
}
