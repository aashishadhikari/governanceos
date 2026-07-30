// Centralizes notification wording and destination URLs so every module
// produces consistent notifications instead of inventing its own. Private
// to the notification service — callers only ever provide
// type/entityType/entityId/metadata via lib/notifications/service.ts,
// never title/message/url directly.

import type { NotificationType, NotificationEntityType } from '@prisma/client';

interface TemplateContext {
  actorName: string | null;
  metadata: Record<string, unknown> | null | undefined;
}

interface RenderedNotification {
  title: string;
  message: string;
}

const TEMPLATES: Record<NotificationType, (ctx: TemplateContext) => RenderedNotification> = {
  SUBMISSION_STATUS_CHANGED: ({ actorName, metadata }) => {
    const subject = (metadata?.submissionTitle as string | undefined) ?? 'Your submission';
    const newStatus = (metadata?.newStatus as string | undefined) ?? 'updated';
    return {
      title: 'Submission status changed',
      message: actorName
        ? `${actorName} changed "${subject}" to ${newStatus}.`
        : `"${subject}" was changed to ${newStatus}.`,
    };
  },
  APPROVAL_REQUESTED: ({ actorName, metadata }) => {
    const subject = (metadata?.subject as string | undefined) ?? 'an item';
    return {
      title: 'Approval requested',
      message: actorName
        ? `${actorName} requested your approval on ${subject}.`
        : `Your approval was requested on ${subject}.`,
    };
  },
  TASK_ASSIGNED: ({ actorName, metadata }) => {
    const subject = (metadata?.subject as string | undefined) ?? 'a task';
    return {
      title: 'Task assigned',
      message: actorName
        ? `${actorName} assigned you ${subject}.`
        : `You were assigned ${subject}.`,
    };
  },
  DOCUMENT_SHARED: ({ actorName, metadata }) => {
    const subject = (metadata?.documentName as string | undefined) ?? 'a document';
    return {
      title: 'Document shared',
      message: actorName
        ? `${actorName} shared "${subject}" with you.`
        : `"${subject}" was shared with you.`,
    };
  },
  MEETING_ASSIGNED: ({ actorName, metadata }) => {
    const subject = (metadata?.meetingTitle as string | undefined) ?? 'a meeting';
    return {
      title: 'Meeting assigned',
      message: actorName
        ? `${actorName} added you to ${subject}.`
        : `You were added to ${subject}.`,
    };
  },
};

export function renderNotification(
  type: NotificationType,
  ctx: TemplateContext
): RenderedNotification {
  return TEMPLATES[type](ctx);
}

// Only Submission and Board Meeting have real per-id detail routes today —
// the rest fall back to their list page, matching actual app navigation
// rather than an assumed one (verified: Submissions has no /:id route,
// it's a list with client-side selection state).
const ENTITY_URL_MAP: Record<NotificationEntityType, (entityId: string) => string> = {
  SUBMISSION: () => '/admin/submissions',
  DOCUMENT: () => '/documents',
  BOARD_MEETING: (entityId) => `/board-meetings/${entityId}`,
  COMPLIANCE_OBLIGATION: () => '/compliance',
};

export function buildNotificationUrl(entityType: NotificationEntityType, entityId: string): string {
  return ENTITY_URL_MAP[entityType](entityId);
}
