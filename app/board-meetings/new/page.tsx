import NewMeetingClient from './NewMeetingClient';
import {
  getEntities,
  getDirectors,
  getBoardMeetings,
  getMeetingAttendees,
} from '@/lib/db/queries';
import { getAuthSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import AccessDenied from '@/components/ui/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function NewBoardMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;

  // Dual-purpose page: editing an existing meeting requires MEETING_EDIT,
  // creating a new one requires MEETING_CREATE — mirrors the existing
  // edit-vs-create branch this page already uses for data loading below.
  const session = await getAuthSession();
  const requiredPermission = edit ? PermissionCodes.MEETING_EDIT : PermissionCodes.MEETING_CREATE;
  const allowed = await hasPermission(session, requiredPermission);
  if (!allowed) {
    return (
      <AccessDenied message="You don't have permission to access Board Meetings." />
    );
  }

  const [entities, directors, boardMeetings, meetingAttendees] = await Promise.all([
    getEntities(),
    getDirectors(),
    edit ? getBoardMeetings() : Promise.resolve([]),
    edit ? getMeetingAttendees() : Promise.resolve([]),
  ]);

  const editMeeting = edit ? boardMeetings.find(m => m.id === edit) ?? null : null;
  const editAttendees = edit ? meetingAttendees.filter(a => a.meetingId === edit) : [];

  return (
    <NewMeetingClient
      entities={entities}
      directors={directors}
      editMeeting={editMeeting}
      editAttendees={editAttendees}
    />
  );
}
