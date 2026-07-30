import Header from '@/components/layout/Header';
import { getLicenses, getEntities } from '@/lib/db/queries';
import LicensesClient from './LicensesClient';
import { getAuthSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import AccessDenied from '@/components/ui/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function LicensesPage() {
  const session = await getAuthSession();
  const allowed = await hasPermission(session, PermissionCodes.LICENSE_VIEW);
  if (!allowed) {
    return (
      <AccessDenied message="You don't have permission to access Licenses." />
    );
  }

  const [licenses, entities] = await Promise.all([getLicenses(), getEntities()]);

  return (
    <div>
      <Header
        title="License Management"
        subtitle={`${licenses.length} licenses across ${new Set(licenses.map(l => l.entityId)).size} entities`}
      />
      <LicensesClient initialLicenses={licenses} entities={entities} />
    </div>
  );
}
