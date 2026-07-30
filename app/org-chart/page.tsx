import Header from '@/components/layout/Header';
import { getEntities } from '@/lib/db/queries';
import OrgChartPageClient from './OrgChartPageClient';
import { getAuthSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import AccessDenied from '@/components/ui/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function OrgChartPage() {
  const session = await getAuthSession();
  const allowed = await hasPermission(session, PermissionCodes.ORGCHART_VIEW);
  if (!allowed) {
    return (
      <AccessDenied message="You don't have permission to access the Organization Chart." />
    );
  }

  const entities = await getEntities();
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
      <Header
        title="Corporate Org Chart"
        subtitle="Interactive group structure — click any entity to view its profile"
      />
      <OrgChartPageClient entities={entities} />
    </div>
  );
}
