import { getAlerts, getEntities } from '@/lib/db/queries';
import { generateAlerts } from '@/lib/alertEngine';
import AlertsClient from './AlertsClient';
import { getAuthSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import AccessDenied from '@/components/ui/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const session = await getAuthSession();
  const allowed = await hasPermission(session, PermissionCodes.ALERT_VIEW);
  if (!allowed) {
    return (
      <AccessDenied message="You don't have permission to access Alerts." />
    );
  }

  // Ensure alerts are up-to-date whenever this page is opened.
  // Safe because generateAlerts() deduplicates existing alerts.
  await generateAlerts();

  const [alerts, entities] = await Promise.all([
    getAlerts(),
    getEntities(),
  ]);

  return <AlertsClient alerts={alerts} entities={entities} />;
}