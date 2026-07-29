// Seeds the Permission catalog documented in docs/security/02-permission-catalog.md.
// Run manually: npx tsx scripts/seed-permissions.ts
// Idempotent — safe to re-run; existing permissions (matched by `code`) are left untouched.
// Does NOT assign any permission to a role (see docs/security/06-migration-plan.md, Phase 3).

import 'dotenv/config';
import prisma from '../lib/prisma';

interface PermissionSeed {
  code: string;
  name: string;
  description: string;
  module: string;
}

const permissions: PermissionSeed[] = [
  // ── Dashboard ────────────────────────────────────────────────────────────────
  { code: 'dashboard.view', name: 'View Dashboard', description: 'View the aggregated dashboard overview.', module: 'dashboard' },

  // ── Entities ─────────────────────────────────────────────────────────────────
  { code: 'entity.view', name: 'View Entities', description: 'View legal entities in the registry.', module: 'entities' },
  { code: 'entity.create', name: 'Create Entities', description: 'Register a new legal entity.', module: 'entities' },
  { code: 'entity.edit', name: 'Edit Entities', description: 'Edit an existing legal entity.', module: 'entities' },
  { code: 'entity.delete', name: 'Delete Entities', description: 'Delete a legal entity.', module: 'entities' },
  { code: 'entity.tor.generate', name: 'Generate Terms of Reference', description: 'Generate a Board Terms of Reference document for an entity.', module: 'entities' },
  { code: 'entity.tor.settings.manage', name: 'Manage ToR Settings', description: 'View and update Terms of Reference generation settings for an entity.', module: 'entities' },

  // ── Organization Chart ───────────────────────────────────────────────────────
  { code: 'orgchart.view', name: 'View Organization Chart', description: 'View the visual entity ownership/hierarchy chart.', module: 'org-chart' },

  // ── Governance Team (Directors) ──────────────────────────────────────────────
  { code: 'director.view', name: 'View Governance Team', description: 'View directors and governance team members.', module: 'governance-team' },
  { code: 'director.create', name: 'Create Governance Team Members', description: 'Register a new director or governance team member.', module: 'governance-team' },
  { code: 'director.edit', name: 'Edit Governance Team Members', description: 'Edit an existing director or governance team member.', module: 'governance-team' },
  { code: 'director.delete', name: 'Delete Governance Team Members', description: 'Delete a director or governance team member.', module: 'governance-team' },

  // ── Board Meetings ───────────────────────────────────────────────────────────
  { code: 'meeting.view', name: 'View Board Meetings', description: 'View board meetings.', module: 'board-meetings' },
  { code: 'meeting.create', name: 'Create Board Meetings', description: 'Schedule a new board meeting.', module: 'board-meetings' },
  { code: 'meeting.edit', name: 'Edit Board Meetings', description: 'Edit an existing board meeting.', module: 'board-meetings' },
  { code: 'meeting.resolution.create', name: 'Record Meeting Resolutions', description: 'Record a resolution against a board meeting.', module: 'board-meetings' },
  { code: 'meeting.document.upload', name: 'Upload Meeting Documents', description: 'Attach a document record to a board meeting.', module: 'board-meetings' },

  // ── Calendar ─────────────────────────────────────────────────────────────────
  { code: 'calendar.view', name: 'View Calendar', description: 'View key dates and the regulatory calendar.', module: 'calendar' },

  // ── Compliance ───────────────────────────────────────────────────────────────
  { code: 'compliance.view', name: 'View Compliance Obligations', description: 'View compliance and regulatory obligations.', module: 'compliance' },
  { code: 'compliance.create', name: 'Create Compliance Obligations', description: 'Create a new compliance obligation.', module: 'compliance' },
  { code: 'compliance.edit', name: 'Edit Compliance Obligations', description: 'Edit an existing compliance obligation.', module: 'compliance' },
  { code: 'compliance.delete', name: 'Delete Compliance Obligations', description: 'Delete a compliance obligation.', module: 'compliance' },
  { code: 'compliance.import', name: 'Import Compliance Obligations', description: 'Bulk-import compliance obligations from a CSV file.', module: 'compliance' },
  { code: 'compliance.clear', name: 'Clear Compliance Obligations', description: 'Bulk-delete compliance obligations.', module: 'compliance' },
  { code: 'compliance.calendar.import', name: 'Import Regulatory Calendar', description: 'Import a regulatory calendar into compliance obligations.', module: 'compliance' },

  // ── Licenses ─────────────────────────────────────────────────────────────────
  { code: 'license.view', name: 'View Licenses', description: 'View regulatory licenses.', module: 'licenses' },
  { code: 'license.create', name: 'Create Licenses', description: 'Register a new regulatory license.', module: 'licenses' },

  // ── Regulatory Capital ───────────────────────────────────────────────────────
  { code: 'capital.view', name: 'View Regulatory Capital', description: 'View regulatory capital records and linked bank accounts.', module: 'regulatory-capital' },
  { code: 'capital.edit', name: 'Edit Regulatory Capital', description: 'Update a regulatory capital balance or requirement.', module: 'regulatory-capital' },
  { code: 'capital.import', name: 'Import Bank Accounts', description: 'Bulk-import bank account data from a CSV file.', module: 'regulatory-capital' },
  { code: 'capital.bank_sync', name: 'Sync Bank Balances', description: 'Sync or refresh bank account and capital balances.', module: 'regulatory-capital' },

  // ── Alerts ───────────────────────────────────────────────────────────────────
  { code: 'alert.view', name: 'View Alerts', description: 'View system alerts.', module: 'alerts' },
  { code: 'alert.update', name: 'Update Alerts', description: 'Mark alerts as read or dismissed.', module: 'alerts' },
  { code: 'alert.generate', name: 'Generate Alerts', description: 'Manually trigger alert and health-score generation.', module: 'alerts' },

  // ── Document Vault ───────────────────────────────────────────────────────────
  { code: 'document.view', name: 'View Documents', description: 'View documents in the document vault.', module: 'document-vault' },
  { code: 'document.upload', name: 'Upload Documents', description: 'Upload a new document to the vault.', module: 'document-vault' },
  { code: 'document.download', name: 'Download Documents', description: 'Download a document from the vault.', module: 'document-vault' },
  { code: 'document.delete', name: 'Delete Documents', description: 'Soft-delete a document from the vault.', module: 'document-vault' },

  // ── Users ────────────────────────────────────────────────────────────────────
  { code: 'user.view', name: 'View Users', description: 'View platform users.', module: 'users' },
  { code: 'user.create', name: 'Create Users', description: 'Create a new platform user and send an invitation.', module: 'users' },
  { code: 'user.edit', name: 'Edit Users', description: 'Edit an existing user.', module: 'users' },
  { code: 'user.deactivate', name: 'Deactivate Users', description: 'Deactivate a user, revoking their access.', module: 'users' },
  { code: 'user.reactivate', name: 'Reactivate Users', description: 'Reactivate a previously deactivated user.', module: 'users' },
  { code: 'user.password_reset.send', name: 'Send Password Reset', description: 'Resend a password setup or reset invitation to a user.', module: 'users' },

  // ── Roles ────────────────────────────────────────────────────────────────────
  { code: 'role.view', name: 'View Roles', description: 'View roles.', module: 'roles' },
  { code: 'role.create', name: 'Create Roles', description: 'Create a new custom role.', module: 'roles' },
  { code: 'role.edit', name: 'Edit Roles', description: 'Edit an existing role.', module: 'roles' },
  { code: 'role.delete', name: 'Delete Roles', description: 'Delete a custom role that has no users assigned.', module: 'roles' },

  // ── Submissions ──────────────────────────────────────────────────────────────
  { code: 'submission.view', name: 'View Submissions', description: 'View bug/feature submissions.', module: 'submissions' },
  { code: 'submission.create', name: 'Create Submissions', description: 'Submit a bug report or feature request.', module: 'submissions' },
  { code: 'submission.approve', name: 'Approve Submissions', description: 'Approve a submitted bug/feature request.', module: 'submissions' },
  { code: 'submission.reject', name: 'Reject Submissions', description: 'Reject a submitted bug/feature request.', module: 'submissions' },
  { code: 'submission.status.update', name: 'Update Submission Status', description: 'Transition a submission through implementing/done states.', module: 'submissions' },
];

async function main() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {},
      create: permission,
    });
  }

  console.log(`✅ ${permissions.length} permissions seeded successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
