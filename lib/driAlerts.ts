/**
 * DRI Alert Engine
 *
 * Sends proactive Slack DMs to Directly Responsible Individuals (DRIs)
 * for upcoming regulatory calendar filings.
 *
 * Alert thresholds: 30 / 14 / 7 days before due date.
 * Deduplicates: will not re-alert the same DRI for the same obligation
 * at the same threshold within 6 days.
 *
 * Requires env vars:
 *   SLACK_BOT_TOKEN   — xoxb-... token with chat:write and im:write scopes
 *   SLACK_ALERT_CHANNEL — fallback channel (e.g. #compliance-alerts) if no Slack ID configured
 *
 * To trigger: GET /api/cron/dri-alerts  (secure with CRON_SECRET header)
 */

import prisma from '@/lib/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

interface DriEntry {
  slackId: string;
  email: string;
  name: string;
}

interface DriConfig {
  thresholds: number[];
  slackChannel: string;
  dris: Record<string, DriEntry>;
}

function loadConfig(): DriConfig {
  const path = join(process.cwd(), 'prisma', 'data', 'dri-config.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as DriConfig;
}

function daysUntil(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

/** Parse DRI names from the notes field.
 *  Notes format: "Compliance DRI: Matt H | Finance DRI: Karen G"
 *  Returns array like ["Matt H", "Karen G"]
 */
function parseDriNames(notes: string | null): string[] {
  if (!notes) return [];
  const names: string[] = [];
  const matches = notes.matchAll(/(?:Compliance|Finance)\s+DRI:\s*([^|$\n]+)/gi);
  for (const match of matches) {
    const name = match[1].trim();
    if (name) names.push(name);
  }
  return [...new Set(names)]; // deduplicate
}

/** Find best-match DRI config entry — exact first, then fuzzy (starts-with). */
function lookupDri(name: string, dris: Record<string, DriEntry>): DriEntry | null {
  if (dris[name]) return dris[name];
  // Fuzzy: find a key that starts with the first word of the name
  const firstWord = name.split(' ')[0].toLowerCase();
  const fuzzy = Object.entries(dris).find(
    ([key]) => key.toLowerCase().startsWith(firstWord)
  );
  return fuzzy ? fuzzy[1] : null;
}

/** Send a Slack message. Returns true on success. */
async function sendSlack(
  target: string, // Slack user ID (Uxxxxxx) or channel (#channel)
  text: string,
  blocks: object[],
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: target, text, blocks }),
    });
    const json = await res.json() as { ok: boolean; error?: string };
    if (!json.ok) {
      console.warn(`[driAlerts] Slack error sending to ${target}:`, json.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[driAlerts] Slack fetch error:', err);
    return false;
  }
}

/** Build a rich Slack Block Kit message for a filing reminder. */
function buildSlackBlocks(params: {
  driName: string;
  filingName: string;
  entityName: string;
  regulator: string;
  daysLeft: number;
  dueDate: string;
  owner: string;
}): { text: string; blocks: object[] } {
  const { driName, filingName, entityName, regulator, daysLeft, dueDate, owner } = params;

  const urgencyEmoji = daysLeft <= 7 ? '🚨' : daysLeft <= 14 ? '⚠️' : '📋';
  const urgencyLabel = daysLeft <= 7 ? 'URGENT' : daysLeft <= 14 ? 'ACTION NEEDED' : 'REMINDER';
  const text = `${urgencyEmoji} ${urgencyLabel}: ${filingName} due in ${daysLeft} day(s) — ${entityName}`;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${urgencyEmoji} Filing Due in ${daysLeft} Day${daysLeft === 1 ? '' : 's'}`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Hi ${driName}, you are the DRI for an upcoming regulatory filing.\n\n*${filingName}*`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Entity*\n${entityName}` },
        { type: 'mrkdwn', text: `*Regulator*\n${regulator}` },
        { type: 'mrkdwn', text: `*Due Date*\n${dueDate}` },
        { type: 'mrkdwn', text: `*Lead Team*\n${owner}` },
      ],
    },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Regulatory Calendar', emoji: true },
          url: `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/compliance/regulatory-calendar`,
          style: daysLeft <= 7 ? 'danger' : 'primary',
        },
      ],
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `_Sent by EntityOS · Regulatory Calendar · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}_` },
      ],
    },
  ];

  return { text, blocks };
}

export interface DriAlertResult {
  sent: number;
  skipped: number;
  errors: number;
  noSlackToken: boolean;
  details: string[];
}

export async function runDriAlerts(): Promise<DriAlertResult> {
  const config = loadConfig();
  const token = process.env.SLACK_BOT_TOKEN ?? '';
  const fallbackChannel = process.env.SLACK_ALERT_CHANNEL ?? config.slackChannel;
  const hasSlack = !!token;

  const result: DriAlertResult = { sent: 0, skipped: 0, errors: 0, noSlackToken: !hasSlack, details: [] };

  // Fetch all pending calendar obligations due within 30 days (or overdue)
  const obligations = await prisma.$queryRaw<Array<{
    id: string;
    entityId: string;
    requirementType: string;
    regulator: string;
    dueDate: Date;
    owner: string;
    notes: string | null;
    status: string;
  }>>`
    SELECT id, "entityId", "requirementType", regulator, "dueDate", owner, notes, status
    FROM compliance_obligations
    WHERE source = 'calendar'
      AND status IN ('pending', 'overdue')
      AND "dueDate" <= NOW() + INTERVAL '30 days'
    ORDER BY "dueDate" ASC
  `;

  // Load entity names
  const entities = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name FROM entities
  `;
  const entityMap = Object.fromEntries(entities.map(e => [e.id, e.name]));

  const now = new Date();
  const sixDaysAgo = new Date(now.getTime() - 6 * 86_400_000);

  for (const ob of obligations) {
    const daysLeft = daysUntil(ob.dueDate);

    // Only alert at configured thresholds (30, 14, 7) or if overdue
    const hitThreshold = config.thresholds.some(t => daysLeft <= t && daysLeft > (t - 7)) || daysLeft < 0;
    if (!hitThreshold) { result.skipped++; continue; }

    const driNames = parseDriNames(ob.notes);
    if (driNames.length === 0) { result.skipped++; continue; }

    const entityName = entityMap[ob.entityId] ?? ob.entityId;
    const dueStr = ob.dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    for (const driName of driNames) {
      const dri = lookupDri(driName, config.dris);

      // Deduplication: check if we already sent an in-app alert for this obligation+DRI recently
      const alertKey = `dri:${ob.id}:${driName}:${daysLeft <= 7 ? '7' : daysLeft <= 14 ? '14' : '30'}`;
      const recentAlert = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM alerts
        WHERE "relatedId" = ${alertKey}
          AND "createdAt" > ${sixDaysAgo}
        LIMIT 1
      `;
      if (recentAlert.length > 0) { result.skipped++; continue; }

      // Send Slack message
      let slackSent = false;
      if (hasSlack) {
        const target = dri?.slackId || fallbackChannel;
        const { text, blocks } = buildSlackBlocks({
          driName: dri?.name ?? driName,
          filingName: ob.requirementType,
          entityName,
          regulator: ob.regulator,
          daysLeft: Math.max(daysLeft, 0),
          dueDate: dueStr,
          owner: ob.owner,
        });
        slackSent = await sendSlack(target, text, blocks, token);
        if (slackSent) result.sent++;
        else result.errors++;
      }

      // Always create an in-app alert (regardless of Slack success)
      try {
        await prisma.$executeRaw`
          INSERT INTO alerts ("id", "entityId", title, message, severity, category, "relatedId", status, "createdAt", "updatedAt")
          VALUES (
            ${`alert-dri-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`},
            ${ob.entityId},
            ${`DRI Alert (${daysLeft <= 0 ? 'OVERDUE' : `${daysLeft}d`}): ${ob.requirementType}`},
            ${`${ob.requirementType} for ${entityName} (${ob.regulator}) is due ${daysLeft <= 0 ? `${Math.abs(daysLeft)}d ago` : `in ${daysLeft} days`}. DRI: ${dri?.name ?? driName}. ${hasSlack && slackSent ? 'Slack DM sent.' : 'Configure SLACK_BOT_TOKEN for Slack DMs.'}`},
            ${daysLeft <= 7 ? 'critical' : daysLeft <= 14 ? 'warning' : 'info'},
            'compliance',
            ${alertKey},
            'unread',
            NOW(),
            NOW()
          )
        `;
        if (!hasSlack) result.sent++; // count in-app as "sent" when no Slack
      } catch (err) {
        console.error('[driAlerts] Failed to create in-app alert:', err);
        result.errors++;
      }

      result.details.push(`${slackSent ? '✓ Slack' : hasSlack ? '✗ Slack' : '✓ In-app'} → ${dri?.name ?? driName} | ${ob.requirementType} | ${entityName} | ${daysLeft}d`);
    }
  }

  return result;
}
