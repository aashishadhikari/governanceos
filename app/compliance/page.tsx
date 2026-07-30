import { getComplianceObligations, getEntities } from '@/lib/db/queries';
import ComplianceClient from './ComplianceClient';
import { getAuthSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import AccessDenied from '@/components/ui/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function CompliancePage() {
  const session = await getAuthSession();
  const allowed = await hasPermission(session, PermissionCodes.COMPLIANCE_VIEW);
  if (!allowed) {
    return (
      <AccessDenied message="You don't have permission to access Compliance & Finance." />
    );
  }

  const [complianceObligations, entities] = await Promise.all([
    getComplianceObligations(),
    getEntities(),
  ]);

  return <ComplianceClient initialObligations={complianceObligations} entities={entities} />;
}
