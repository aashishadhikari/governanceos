/**
 * GET /api/cron/dri-alerts
 *
 * Sends Slack DMs to DRIs for upcoming regulatory filings.
 * Secure with CRON_SECRET env var — pass as Authorization header or ?secret= query param.
 *
 * Call this daily via a cron job or manually from the Regulatory Calendar admin UI.
 *
 * Example cron (runs daily at 8am SGT = midnight UTC):
 *   0 0 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/dri-alerts
 */

import { NextResponse } from 'next/server';
import { runDriAlerts } from '@/lib/driAlerts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  // Auth check — skip if CRON_SECRET not set (dev convenience)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    const url = new URL(request.url);
    const querySecret = url.searchParams.get('secret');
    const provided = authHeader?.replace('Bearer ', '') ?? querySecret;
    if (provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await runDriAlerts();

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...result,
      message: result.noSlackToken
        ? `Alerts created in-app only — add SLACK_BOT_TOKEN to .env to enable Slack DMs. ${result.sent} sent, ${result.skipped} skipped.`
        : `${result.sent} DRI alerts sent, ${result.skipped} skipped (already alerted), ${result.errors} errors.`,
    });
  } catch (err) {
    console.error('[cron/dri-alerts]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
