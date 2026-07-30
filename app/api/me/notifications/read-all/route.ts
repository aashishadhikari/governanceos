// PATCH /api/me/notifications/read-all — mark all of the caller's own
// unread notifications read. Ownership-based, not RBAC.
import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { markAllRead } from '@/lib/notifications/service';

export async function PATCH() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await markAllRead(session.user.id);
  return NextResponse.json({ success: true, updated: result.count });
}
