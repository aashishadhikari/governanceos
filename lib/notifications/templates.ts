// Centralizes notification wording and destination URLs so every module
// produces consistent notifications instead of inventing its own. Private
// to the notification service — callers only ever provide
// type/entityType/entityId/metadata via lib/notifications/service.ts,
// never title/message/url directly.

import type { NotificationType, NotificationEntityType } from '@prisma/client';
import { ROLE_LABELS, type UserRole } from '@/lib/db/users';

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
    const requirementType = metadata?.requirementType as string | undefined;
    return {
      // Business object surfaced in the title (scannable in the bell
      // without opening the message) whenever the caller provides one.
      title: requirementType ? `Task assigned: ${requirementType}` : 'Task assigned',
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
    const meetingTitle = (metadata?.meetingTitle as string | undefined) ?? 'a meeting';
    return {
      title: metadata?.meetingTitle ? `Meeting assigned: ${meetingTitle}` : 'Meeting assigned',
      message: actorName
        ? `${actorName} added you to ${meetingTitle}.`
        : `You were added to ${meetingTitle}.`,
    };
  },
  USER_ROLE_CHANGED: ({ actorName, metadata }) => {
    const rawRole = metadata?.newRole as string | undefined;
    const newRole = (rawRole && ROLE_LABELS[rawRole as UserRole]) || rawRole || 'a new role';
    // JWT sessions bake the role in at login (lib/auth/config.ts) — a
    // mid-session role change has no effect until the next login, so the
    // wording says so explicitly rather than hedging with "if needed".
    return {
      title: 'Your role has changed',
      message: actorName
        ? `${actorName} changed your role to ${newRole}. Please log out and sign in again for the new permissions to take effect.`
        : `Your role has been changed to ${newRole}. Please log out and sign in again for the new permissions to take effect.`,
    };
  },
  FILING_DEADLINE: ({ metadata }) => {
    const subject = (metadata?.requirementType as string | undefined) ?? 'a filing';
    const urgency = metadata?.urgency as 'due_soon' | 'overdue' | undefined;
    const days = metadata?.daysRemaining as number | undefined;

    if (urgency === 'overdue') {
      const overdueBy = typeof days === 'number' ? Math.abs(days) : undefined;
      return {
        // Requirement name lives in the title so multiple filing
        // notifications are distinguishable at a glance in the bell,
        // without needing to read the (line-clamped) message.
        title: `Filing overdue: ${subject}`,
        message: overdueBy !== undefined
          ? `Overdue by ${overdueBy} day${overdueBy === 1 ? '' : 's'}. Immediate action required.`
          : `Overdue. Immediate action required.`,
      };
    }

    return {
      title: `Filing due soon: ${subject}`,
      message: typeof days === 'number'
        ? `Due in ${days} day${days === 1 ? '' : 's'}.`
        : `Due soon.`,
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
  // No per-user profile/account page exists yet — fall back to the
  // dashboard, which every authenticated user can reach regardless of role.
  USER: () => '/',
};

export function buildNotificationUrl(entityType: NotificationEntityType, entityId: string): string {
  return ENTITY_URL_MAP[entityType](entityId);
}
