/**
 * EntityOS Alert Engine
 *
 * Scans compliance obligations, licenses, regulatory capital, and board meetings
 * to generate proactive alerts at 90/60/30-day thresholds and on breach.
 *
 * Call generateAlerts() from the /api/alerts/generate route or a cron job.
 * Deduplicates by (entityId, category, relatedId) so re-running is safe.
 */

import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notifications/service';
import { resolveUserByEmailOrName } from '@/lib/notifications/resolveRecipient';
import { sendNotificationEmail } from '@/lib/email';

function daysUntil(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

interface AlertCandidate {
  entityId: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  relatedId: string;
  // Present only for candidates that should also produce a personal
  // Notification (Filing Due Soon / Filing Overdue). Dedup for this is
  // independent of the Alert row above — see maybeNotifyFilingDeadline.
  notify?: {
    ownerRaw: string;
    requirementType: string;
    regulator: string;
    urgency: 'due_soon' | 'overdue';
    daysRemaining: number;
  };
}

// Sends the FILING_DEADLINE notification (+ email) for a compliance
// obligation, deduplicated against the Notification table itself rather
// than against the Alert model's lifecycle. Scoped by
// (recipient, type, entity, urgency) so:
//   - a due-soon notification already sent doesn't block a later, distinct
//     overdue notification for the same obligation (escalation must fire),
//   - repeated generateAlerts() runs at the *same* urgency don't re-notify,
//     and this holds even if the underlying Alert row was read or
//     dismissed in between — Alert-triage actions must never re-arm a
//     personal notification for an unchanged due date.
async function maybeNotifyFilingDeadline(
  obligationId: string,
  notify: NonNullable<AlertCandidate['notify']>,
): Promise<void> {
  const recipientId = await resolveUserByEmailOrName(notify.ownerRaw);
  if (!recipientId) return;

  const alreadyNotified = await prisma.notification.findFirst({
    where: {
      recipientId,
      type: 'FILING_DEADLINE',
      entityType: 'COMPLIANCE_OBLIGATION',
      entityId: obligationId,
      metadata: { path: ['urgency'], equals: notify.urgency },
    },
  });
  if (alreadyNotified) return;

  // Email must never fire independently of the notification it accompanies.
  // Previously both calls were fire-and-forget siblings with no dependency
  // between them — sharing the dedup check above in name only. Awaiting
  // the write and gating the email on its success makes them one atomic
  // decision: no notification recorded means no email either.
  try {
    await createNotification({
      type: 'FILING_DEADLINE',
      recipientId,
      actorId: null,
      entityType: 'COMPLIANCE_OBLIGATION',
      entityId: obligationId,
      metadata: {
        requirementType: notify.requirementType,
        urgency: notify.urgency,
        daysRemaining: notify.daysRemaining,
      },
    });
  } catch (err) {
    console.error('[alertEngine] filing-deadline notification failed', err);
    return;
  }

  const recipientUser = await prisma.user.findUnique({ where: { id: recipientId }, select: { name: true, email: true } });
  if (recipientUser) {
    const overdue = notify.urgency === 'overdue';
    sendNotificationEmail(recipientUser.email, {
      recipientName: recipientUser.name,
      heading: overdue ? 'Filing overdue' : 'Filing due soon',
      message: overdue
        ? `"${notify.requirementType}" for ${notify.regulator} was due ${Math.abs(notify.daysRemaining)} day(s) ago. Immediate action required.`
        : `"${notify.requirementType}" for ${notify.regulator} is due in ${notify.daysRemaining} day(s).`,
      actionUrl: `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/compliance`,
      actionText: 'Complete Filing',
    }).catch((err) => console.error('[alertEngine] filing-deadline email failed', err));
  }
}

export async function generateAlerts(): Promise<{ created: number; skipped: number }> {
  const candidates: AlertCandidate[] = [];

  // ── Compliance obligations ─────────────────────────────────────────────────
  const obligations = await prisma.complianceObligation.findMany({
    where: { status: { in: ['pending' as any, 'overdue' as any] } },
  });

  for (const ob of obligations) {
    const days = daysUntil(ob.dueDate);
    if (days < 0) {
      candidates.push({
        entityId: ob.entityId,
        title: `OVERDUE: ${ob.requirementType}`,
        message: `${ob.requirementType} for ${ob.regulator} was due ${Math.abs(days)} day(s) ago. Immediate action required.`,
        severity: 'critical',
        category: 'compliance',
        relatedId: ob.id,
        notify: { ownerRaw: ob.owner, requirementType: ob.requirementType, regulator: ob.regulator, urgency: 'overdue', daysRemaining: days },
      });
    } else if (days <= 30) {
      candidates.push({
        entityId: ob.entityId,
        title: `Due in ${days}d: ${ob.requirementType}`,
        message: `${ob.requirementType} for ${ob.regulator} is due in ${days} day(s). Owner: ${ob.owner}.`,
        severity: 'critical',
        category: 'compliance',
        relatedId: ob.id,
        notify: { ownerRaw: ob.owner, requirementType: ob.requirementType, regulator: ob.regulator, urgency: 'due_soon', daysRemaining: days },
      });
    } else if (days <= 60) {
      candidates.push({
        entityId: ob.entityId,
        title: `Upcoming (${days}d): ${ob.requirementType}`,
        message: `${ob.requirementType} for ${ob.regulator} is due in ${days} day(s). Owner: ${ob.owner}.`,
        severity: 'warning',
        category: 'compliance',
        relatedId: ob.id,
      });
    } else if (days <= 90) {
      candidates.push({
        entityId: ob.entityId,
        title: `Reminder (${days}d): ${ob.requirementType}`,
        message: `${ob.requirementType} for ${ob.regulator} is due in ${days} day(s). Owner: ${ob.owner}.`,
        severity: 'info',
        category: 'compliance',
        relatedId: ob.id,
      });
    }
  }

  // ── Licenses ──────────────────────────────────────────────────────────────
  const licenses = await prisma.license.findMany({
    where: { status: { in: ['active' as any, 'pending_renewal' as any] } },
  });

  for (const lic of licenses) {
    if (!lic.expiryDate) continue;
    const days = daysUntil(lic.expiryDate);
    if (days < 0) {
      candidates.push({
        entityId: lic.entityId,
        title: `EXPIRED: ${lic.licenseType}`,
        message: `${lic.licenseType} license (${lic.licenseNumber}) issued by ${lic.regulator} expired ${Math.abs(days)} day(s) ago.`,
        severity: 'critical',
        category: 'license',
        relatedId: lic.id,
      });
    } else if (days <= 30) {
      candidates.push({
        entityId: lic.entityId,
        title: `License expiring in ${days}d: ${lic.licenseType}`,
        message: `${lic.licenseType} (${lic.licenseNumber}) expires in ${days} day(s). Renewal lead time: ${lic.renewalLeadDays} days.`,
        severity: 'critical',
        category: 'license',
        relatedId: lic.id,
      });
    } else if (days <= 60) {
      candidates.push({
        entityId: lic.entityId,
        title: `License renewal due (${days}d): ${lic.licenseType}`,
        message: `${lic.licenseType} (${lic.licenseNumber}) expires in ${days} day(s). Initiate renewal process.`,
        severity: 'warning',
        category: 'license',
        relatedId: lic.id,
      });
    } else if (days <= 90) {
      candidates.push({
        entityId: lic.entityId,
        title: `License renewal reminder (${days}d): ${lic.licenseType}`,
        message: `${lic.licenseType} (${lic.licenseNumber}) expires in ${days} day(s).`,
        severity: 'info',
        category: 'license',
        relatedId: lic.id,
      });
    }
  }

  // ── Regulatory capital ─────────────────────────────────────────────────────
  const capitals = await prisma.regulatoryCapital.findMany();
  for (const cap of capitals) {
    const ratio = cap.minimumRequired > 0 ? cap.currentBalance / cap.minimumRequired : 1;
    if (ratio < 1) {
      candidates.push({
        entityId: cap.entityId,
        title: 'Regulatory Capital Breach',
        message: `Current balance ${cap.currency} ${cap.currentBalance.toLocaleString()} is below minimum required ${cap.currency} ${cap.minimumRequired.toLocaleString()} (${(ratio * 100).toFixed(1)}% coverage). Immediate action required.`,
        severity: 'critical',
        category: 'capital',
        relatedId: cap.id,
      });
    } else if (ratio < 1.2) {
      candidates.push({
        entityId: cap.entityId,
        title: 'Capital Below Buffer Threshold',
        message: `Current balance is at ${(ratio * 100).toFixed(1)}% of minimum required — below the 20% safety buffer. Monitor closely.`,
        severity: 'warning',
        category: 'capital',
        relatedId: cap.id,
      });
    }
  }

  // ── Board meetings ─────────────────────────────────────────────────────────
  const meetings = await prisma.boardMeeting.findMany({
    where: { status: 'scheduled' as any },
  });
  for (const m of meetings) {
    const days = daysUntil(m.meetingDate);
    if (days >= 0 && days <= 14) {
      candidates.push({
        entityId: m.entityId,
        title: `Board meeting in ${days}d`,
        message: `${m.meetingType} is scheduled for ${m.meetingDate.toISOString().slice(0, 10)}. Chair: ${m.chair}. Ensure quorum and materials are ready.`,
        severity: days <= 7 ? 'warning' : 'info',
        category: 'meeting',
        relatedId: m.id,
      });
    }
  }

  // ── Deduplicate & persist ──────────────────────────────────────────────────
  // Only create alerts that don't already exist as unread for this relatedId
  let created = 0;
  let skipped = 0;

  for (const c of candidates) {
    const existing = await prisma.alert.findFirst({
      where: {
        entityId: c.entityId,
        category: c.category,
        relatedId: c.relatedId,
        status: { in: ['unread' as any, 'read' as any] },
      },
    });
    if (existing) {
      skipped++;
    } else {
      // `notify` isn't a column on Alert — strip it before persisting.
      const { notify, ...alertData } = c;
      await prisma.alert.create({ data: alertData as any });
      created++;
    }

    // Deliberately NOT gated on the Alert-level check above: the personal
    // notification has its own dedup (by recipient/type/entity/urgency,
    // via maybeNotifyFilingDeadline below) so it must be evaluated every
    // run regardless of whether the org-wide Alert row already existed —
    // otherwise an un-dismissed 90-day Alert would permanently block the
    // later, more urgent due-soon/overdue notification for the same
    // obligation from ever firing.
    if (c.notify) {
      await maybeNotifyFilingDeadline(c.relatedId, c.notify);
    }
  }

  return { created, skipped };
}

// ── Entity health score (0–100) ────────────────────────────────────────────
// Weights: compliance 40%, licenses 25%, capital 20%, meetings 15%

export async function computeHealthScore(entityId: string): Promise<number> {
  const [compliance, licenses, capital, meetings] = await Promise.all([
    prisma.complianceObligation.findMany({ where: { entityId } }),
    prisma.license.findMany({ where: { entityId } }),
    prisma.regulatoryCapital.findFirst({ where: { entityId } }),
    prisma.boardMeeting.findMany({ where: { entityId, status: { in: ['scheduled' as any, 'completed' as any] } } }),
  ]);

  // Compliance score (40%)
  let compScore = 100;
  if (compliance.length > 0) {
    const overdue = compliance.filter(c => c.status === 'overdue').length;
    const pending = compliance.filter(c => c.status === 'pending').length;
    const total = compliance.length;
    compScore = Math.max(0, 100 - (overdue / total) * 60 - (pending / total) * 20);
  }

  // License score (25%)
  let licScore = 100;
  if (licenses.length > 0) {
    const expired = licenses.filter(l => l.status === 'expired').length;
    const expiringSoon = licenses.filter(l => {
      if (!l.expiryDate) return false;
      const d = daysUntil(l.expiryDate);
      return d >= 0 && d <= 90;
    }).length;
    const total = licenses.length;
    licScore = Math.max(0, 100 - (expired / total) * 70 - (expiringSoon / total) * 20);
  }

  // Capital score (20%)
  let capScore = 100;
  if (capital) {
    const ratio = capital.minimumRequired > 0
      ? capital.currentBalance / capital.minimumRequired
      : 1;
    if (ratio < 1) capScore = 0;
    else if (ratio < 1.1) capScore = 40;
    else if (ratio < 1.2) capScore = 70;
    else capScore = 100;
  }

  // Meeting score (15%) — has any meeting been completed in the last 6 months?
  let meetScore = 100;
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentCompleted = meetings.filter(
    m => m.status === 'completed' && m.meetingDate > sixMonthsAgo
  );
  if (meetings.length > 0 && recentCompleted.length === 0) meetScore = 40;

  const score = compScore * 0.40 + licScore * 0.25 + capScore * 0.20 + meetScore * 0.15;
  return Math.round(score);
}

export async function updateAllHealthScores(): Promise<void> {
  // Use $executeRaw so this works regardless of whether 'prisma generate'
  // has been re-run after the migration that added the healthScore column.
  const entities = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "entities" WHERE status IN ('active', 'dormant')
  `;
  for (const e of entities) {
    try {
      const score = await computeHealthScore(e.id);
      await prisma.$executeRaw`
        UPDATE "entities" SET "healthScore" = ${score}, "updatedAt" = NOW() WHERE id = ${e.id}
      `;
    } catch (err) {
      console.warn(`[alertEngine] Health score update failed for entity ${e.id}:`, err);
    }
  }
}
