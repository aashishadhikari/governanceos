import EntitiesClient from './EntitiesClient';
import { getEntities, getComplianceObligations, getLicenses, getRegulatoryCapital } from '@/lib/db/queries';
import { getAuthSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import AccessDenied from '@/components/ui/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function EntitiesPage() {
  const session = await getAuthSession();
  const allowed = await hasPermission(session, PermissionCodes.ENTITY_VIEW);
  if (!allowed) {
    return (
      <AccessDenied message="You don't have permission to access Entity Management." />
    );
  }

  const [entities, complianceObligations, licenses, regulatoryCapital] = await Promise.all([
    getEntities(),
    getComplianceObligations(),
    getLicenses(),
    getRegulatoryCapital(),
  ]);

  return <EntitiesClient entities={entities} complianceObligations={complianceObligations} licenses={licenses} regulatoryCapital={regulatoryCapital} />;
}
