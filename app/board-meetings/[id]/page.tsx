import {
  getBoardMeetings,
  getMeetingAttendees,
  getMeetingDocuments,
  getMeetingResolutions,
  getEntities,
  getDirectors,
} from '@/lib/db/queries';
import MeetingDetailClient from './MeetingDetailClient';
import { getAuthSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import AccessDenied from '@/components/ui/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  const allowed = await hasPermission(session, PermissionCodes.MEETING_VIEW);
  if (!allowed) {
    return (
      <AccessDenied message="You don't have permission to access Board Meetings." />
    );
  }

  const { id } = await params;
  const [
    boardMeetings,
    meetingAttendees,
    meetingDocuments,
    meetingResolutions,
    entities,
    directors,
  ] = await Promise.all([
    getBoardMeetings(),
    getMeetingAttendees(),
    getMeetingDocuments(),
    getMeetingResolutions(),
    getEntities(),
    getDirectors(),
  ]);

  return (
    <MeetingDetailClient
      id={id}
      boardMeetings={boardMeetings}
      meetingAttendees={meetingAttendees}
      meetingDocuments={meetingDocuments}
      meetingResolutions={meetingResolutions}
      entities={entities}
      directors={directors}
    />
  );
}
