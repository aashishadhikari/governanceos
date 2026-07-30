// The only module allowed to write to the `notifications` table. Every
// other module must call createNotification() after its own business
// logic succeeds — never prisma.notification.create() directly.
//
// Personal notifications are ownership-based, not RBAC-based: every
// function here takes recipientId as a required parameter so ownership is
// enforced at the data layer, not left to each caller to remember.

import prisma from '@/lib/prisma';
import type { NotificationType, NotificationEntityType, Prisma } from '@prisma/client';
import { renderNotification, buildNotificationUrl } from './templates';

export interface CreateNotificationInput {
  type: NotificationType;
  recipientId: string;
  actorId?: string | null;
  entityType: NotificationEntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const actor = input.actorId
    ? await prisma.user.findUnique({ where: { id: input.actorId }, select: { name: true } })
    : null;

  // title/message are generated once, at creation time, and stored — a
  // point-in-time snapshot, same convention as AuditLog.oldValues/
  // newValues, so a later actor name change never rewrites past wording.
  const { title, message } = renderNotification(input.type, {
    actorName: actor?.name ?? null,
    metadata: input.metadata,
  });

  await prisma.notification.create({
    data: {
      recipientId: input.recipientId,
      actorId: input.actorId ?? null,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      title,
      message,
      url: buildNotificationUrl(input.entityType, input.entityId),
      metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

export async function markRead(notificationId: string, recipientId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, recipientId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(recipientId: string) {
  return prisma.notification.updateMany({
    where: { recipientId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function listForUser(recipientId: string, opts?: { unreadOnly?: boolean }) {
  return prisma.notification.findMany({
    where: {
      recipientId,
      ...(opts?.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}
