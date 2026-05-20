import { getEntities } from '@/lib/db/queries';
import RegulatoryCalendarClient from './RegulatoryCalendarClient';

export const dynamic = 'force-dynamic';

export default async function RegulatoryCalendarPage() {
  const entities = await getEntities();
  return <RegulatoryCalendarClient entities={entities} />;
}
