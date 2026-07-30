import Header from '@/components/layout/Header';
import { getSubmissions } from '@/lib/db/queries';
import SubmissionsClient from './SubmissionsClient';
import { getAuthSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import AccessDenied from '@/components/ui/AccessDenied';

export default async function SubmissionsPage() {
  const session = await getAuthSession();
  const allowed = await hasPermission(session, PermissionCodes.SUBMISSION_VIEW);
  if (!allowed) {
    return (
      <AccessDenied message="You don't have permission to access Submissions." />
    );
  }

  let submissions: Awaited<ReturnType<typeof getSubmissions>> = [];
  try {
    submissions = await getSubmissions();
  } catch {
    // Table may not exist yet if migration hasn't run
  }
  return (
    <div>
      <Header title="Submissions" subtitle="Bug reports and feature requests — review, generate PRDs, approve or reject" />
      <SubmissionsClient initialSubmissions={submissions} />
    </div>
  );
}
