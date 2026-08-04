/**
 * GET  /api/admin/dri-config — returns current DRI → Slack/email mapping
 * PUT  /api/admin/dri-config — updates the mapping (saves to dri-config.json)
 */

import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';

const CONFIG_PATH = join(process.cwd(), 'prisma', 'data', 'dri-config.json');

export async function GET() {
  const denied = await authorizeRequest(PermissionCodes.ALERT_UPDATE);
  if (denied) return denied;

  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    return NextResponse.json(config);
  } catch (err) {
    console.error('[dri-config]', err);
    return NextResponse.json({ error: 'Failed to load DRI configuration.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await authorizeRequest(PermissionCodes.ALERT_UPDATE);
  if (denied) return denied;

  try {
    const body = await request.json();
    // Merge with existing config to avoid accidentally wiping fields
    const existing = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const updated = { ...existing, ...body };
    writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
    return NextResponse.json({ ok: true, config: updated });
  } catch (err) {
    console.error('[dri-config]', err);
    return NextResponse.json({ error: 'Failed to update DRI configuration.' }, { status: 500 });
  }
}
