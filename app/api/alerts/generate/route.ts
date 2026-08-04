import { NextResponse } from 'next/server';
import { generateAlerts, updateAllHealthScores } from '@/lib/alertEngine';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';

export async function POST() {
  const denied = await authorizeRequest(PermissionCodes.ALERT_GENERATE);
  if (denied) return denied;

  let alertResult = { created: 0, skipped: 0 };
  let healthError: string | null = null;
  let alertError: string | null = null;

  // Run alert generation
  try {
    alertResult = await generateAlerts();
  } catch (err) {
    // Full detail (including stack) stays server-side only — the client
    // response must never include a stack trace or raw exception message.
    console.error('[alerts/generate] generateAlerts failed:', err);
    alertError = 'Alert generation failed. See server logs for details.';
  }

  // Run health score update (independently — don't let it block alerts)
  try {
    await updateAllHealthScores();
  } catch (err) {
    console.error('[alerts/generate] updateAllHealthScores failed:', err);
    healthError = 'Health score update failed. See server logs for details.';
  }

  // If both failed, return 500 with details
  if (alertError && healthError) {
    return NextResponse.json({
      error: 'Both alert generation and health score update failed',
      alertError,
      healthError,
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    alerts: alertResult,
    message: `Created ${alertResult.created} new alerts, skipped ${alertResult.skipped} duplicates. Health scores updated.`,
    ...(alertError ? { alertWarning: alertError } : {}),
    ...(healthError ? { healthWarning: healthError } : {}),
  });
}

// Allow GET for easy triggering from browser
export async function GET() {
  return POST();
}
