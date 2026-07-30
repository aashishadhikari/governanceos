import Header from '@/components/layout/Header';
import { getEntities, getDocuments } from '@/lib/db/queries';
import DocumentsClient from './DocumentsClient';
import { getAuthSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { PermissionCodes } from '@/lib/auth/permission-codes';
import AccessDenied from '@/components/ui/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const session = await getAuthSession();
  const allowed = await hasPermission(session, PermissionCodes.DOCUMENT_VIEW);
  if (!allowed) {
    return (
      <AccessDenied message="You don't have permission to access Document Vault." />
    );
  }

  const [entities, documents] = await Promise.all([getEntities(), getDocuments()]);

  return (
    <div>
      <Header
        title="Document Vault"
        subtitle={`${documents.length} document${documents.length !== 1 ? 's' : ''} · Secure storage with version control`}
      />
      <DocumentsClient entities={entities} initialDocuments={documents} />
    </div>
  );
}
