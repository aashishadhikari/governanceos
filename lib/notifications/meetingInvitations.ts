// Shared by both board-meeting routes (POST create, PATCH attendee re-sync)
// so the resolve → notify → email sequence for a batch of newly-invited
// directors isn't duplicated between them.

import prisma from '@/lib/prisma';
import { createNotification } from './service';
import { resolveUserByEmail } from './resolveRecipient';
import { sendNotificationEmail } from '@/lib/email';

export async function notifyInvitedDirectors(
  meeting: { id: string; meetingType: string; meetingDate: Date },
  directorIds: string[],
  actorId: string | null,
): Promise<void> {
  if (directorIds.length === 0) return;

  const directors = await prisma.director.findMany({
    where: { id: { in: directorIds } },
    select: { id: true, email: true },
  });

  const meetingTitle = `${meeting.meetingType} on ${meeting.meetingDate.toDateString()}`;
  const actionUrl = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/board-meetings/${meeting.id}`;

  for (const director of directors) {
    // Best-effort: most directors have no platform login at all. Resolve
    // by email or silently skip — never guess a recipient.
    const recipientId = await resolveUserByEmail(director.email);
    if (!recipientId) continue;

    createNotification({
      type: 'MEETING_ASSIGNED',
      recipientId,
      actorId,
      entityType: 'BOARD_MEETING',
      entityId: meeting.id,
      metadata: { meetingTitle },
    }).catch((err) => console.error('[board-meetings] invitation notification failed', err));

    const recipientUser = await prisma.user.findUnique({ where: { id: recipientId }, select: { name: true, email: true } });
    if (recipientUser) {
      sendNotificationEmail(recipientUser.email, {
        recipientName: recipientUser.name,
        heading: 'Board meeting invitation',
        message: `You have been invited to ${meetingTitle}.`,
        actionUrl,
        actionText: 'Open Meeting',
      }).catch((err) => console.error('[board-meetings] invitation email failed', err));
    }
  }
}
