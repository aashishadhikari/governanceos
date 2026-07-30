// GET /api/me/notifications — personal notifications for the logged-in user
//
// Ownership supersedes module visibility: authentication + a recipientId
// match is the complete authorization model. No authorizeRequest(), no
// *.view permission — a user always sees their own notifications, even if
// their role no longer grants view access to the module the notification
// came from.
import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { listForUser } from '@/lib/notifications/service';

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unreadOnly') === 'true';

  const notifications = await listForUser(session.user.id, { unreadOnly });
  return NextResponse.json({ data: notifications });
}
