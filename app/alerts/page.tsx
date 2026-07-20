import { getAlerts, getEntities } from '@/lib/db/queries';
import { generateAlerts } from '@/lib/alertEngine';
import AlertsClient from './AlertsClient';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  // Ensure alerts are up-to-date whenever this page is opened.
  // Safe because generateAlerts() deduplicates existing alerts.
  await generateAlerts();

  const [alerts, entities] = await Promise.all([
    getAlerts(),
    getEntities(),
  ]);

  return <AlertsClient alerts={alerts} entities={entities} />;
}