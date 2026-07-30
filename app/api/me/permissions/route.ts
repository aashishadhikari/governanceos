// GET /api/me/permissions — the authenticated user's own effective
// permission codes.
//
// Ownership-based, not RBAC: this is "what can I do," not "browse the
// Roles module" — authentication alone is the complete authorization
// model, same as /api/me/notifications. No authorizeRequest(), no *.view
// permission. Exists to drive client-side rendering decisions (Sidebar
// nav filtering) where a Client Component can't call the server-side
// hasPermission() directly.
import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { getSessionPermissionCodes } from '@/lib/auth/permissions';

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const permissions = await getSessionPermissionCodes(session);
  return NextResponse.json({ permissions });
}
