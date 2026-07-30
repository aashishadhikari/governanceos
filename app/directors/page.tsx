import DirectorsClient from './DirectorsClient';
import { getDirectors, getEntities, getBoardMeetings } from '@/lib/db/queries';
import { getAuthSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import AccessDenied from '@/components/ui/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function DirectorsPage() {
  const session = await getAuthSession();
  const allowed = await hasPermission(session, PermissionCodes.DIRECTOR_VIEW);
  if (!allowed) {
    return (
      <AccessDenied message="You don't have permission to access Governance Team." />
    );
  }

  const [directors, entities, boardMeetings] = await Promise.all([
    getDirectors(),
    getEntities(),
    getBoardMeetings(),
  ]);

  return <DirectorsClient initialDirectors={directors} entities={entities} boardMeetings={boardMeetings} />;
}
