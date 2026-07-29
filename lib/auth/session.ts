import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './config';
import { requirePermission, PermissionError } from './permissions';

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Standardized response for an authenticated request missing a required
// permission. Kept separate from unauthorized() (401, no valid session) —
// this is 403, a valid session that simply lacks the permission.
export function forbidden(permissionCode: string) {
  return NextResponse.json(
    { error: `Forbidden. Missing permission: ${permissionCode}` },
    { status: 403 }
  );
}

// HTTP convenience wrapper around requirePermission() — the only place that
// turns a permission check into a NextResponse. lib/auth/permissions.ts
// itself stays framework-agnostic (no NextResponse import) so it can be
// reused outside route handlers (server actions, scripts, etc.).
//
//   const denied = await authorizeRequest('entity.edit');
//   if (denied) return denied;
export async function authorizeRequest(permissionCode: string): Promise<NextResponse | null> {
  const session = await getAuthSession();

  try {
    await requirePermission(session, permissionCode);
    return null;
  } catch (err) {
    if (err instanceof PermissionError) {
      return forbidden(err.permissionCode);
    }
    throw err;
  }
}
