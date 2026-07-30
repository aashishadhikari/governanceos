import BoardMeetingsClient from './BoardMeetingsClient';
import { getBoardMeetings, getEntities } from '@/lib/db/queries';
import { getAuthSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import AccessDenied from '@/components/ui/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function BoardMeetingsPage() {
  const session = await getAuthSession();
  const allowed = await hasPermission(session, PermissionCodes.MEETING_VIEW);
  if (!allowed) {
    return (
      <AccessDenied message="You don't have permission to access Board Meetings." />
    );
  }

  const [boardMeetings, entities] = await Promise.all([
    getBoardMeetings(),
    getEntities(),
  ]);

  return <BoardMeetingsClient boardMeetings={boardMeetings} entities={entities} />;
}
