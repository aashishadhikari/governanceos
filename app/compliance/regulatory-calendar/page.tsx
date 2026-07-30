import { getEntities } from '@/lib/db/queries';
import RegulatoryCalendarClient from './RegulatoryCalendarClient';
import { getAuthSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import AccessDenied from '@/components/ui/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function RegulatoryCalendarPage() {
  const session = await getAuthSession();
  const allowed = await hasPermission(session, PermissionCodes.COMPLIANCE_VIEW);
  if (!allowed) {
    return (
      <AccessDenied message="You don't have permission to access Compliance & Finance." />
    );
  }

  const entities = await getEntities();
  return <RegulatoryCalendarClient entities={entities} />;
}
