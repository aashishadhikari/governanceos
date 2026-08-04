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
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  // Two legitimate callers: an external cron scheduler (CRON_SECRET, no
  // browser session) and the manual "Send Alerts Now" button in the
  // Regulatory Calendar admin UI (browser session, no secret). This never
  // falls back to "no check" — if CRON_SECRET isn't configured, only an
  // authenticated, permitted user can trigger this; an external caller
  // without the secret is rejected either way.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  const providedSecret = authHeader?.replace('Bearer ', '') ?? querySecret;
  const hasValidSecret = !!cronSecret && providedSecret === cronSecret;

  if (!hasValidSecret) {
    const denied = await authorizeRequest(PermissionCodes.ALERT_GENERATE);
    if (denied) return denied;
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
    return NextResponse.json({ ok: false, error: 'Failed to run DRI alerts.' }, { status: 500 });
  }
}
