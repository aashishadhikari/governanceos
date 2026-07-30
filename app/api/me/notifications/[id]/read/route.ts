// PATCH /api/me/notifications/:id/read — mark one of the caller's own
// notifications read. Ownership-based, not RBAC: markRead() only ever
// matches rows where recipientId equals the caller's own id, so this can
// never be used to mark someone else's notification read.
import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { markRead } from '@/lib/notifications/service';

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(_request: Request, { params }: Props) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const result = await markRead(id, session.user.id);
  if (result.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
