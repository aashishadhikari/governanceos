import { getRegulatoryCapital, getBankAccounts, getEntities } from '@/lib/db/queries';
import CapitalClient from './CapitalClient';
import { getAuthSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import AccessDenied from '@/components/ui/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function CapitalPage() {
  const session = await getAuthSession();
  const allowed = await hasPermission(session, PermissionCodes.CAPITAL_VIEW);
  if (!allowed) {
    return (
      <AccessDenied message="You don't have permission to access Regulatory Capital." />
    );
  }

  const [regulatoryCapital, bankAccounts, entities] = await Promise.all([
    getRegulatoryCapital(),
    getBankAccounts(),
    getEntities(),
  ]);

  return <CapitalClient regulatoryCapital={regulatoryCapital} bankAccounts={bankAccounts} entities={entities} />;
}
