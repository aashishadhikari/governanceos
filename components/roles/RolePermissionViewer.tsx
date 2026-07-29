'use client';

import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/FormField';
import { Check } from 'lucide-react';

// Read-only today. The grouped-by-module rendering below is written to be the
// same structure a future editable Role Permission editor would reuse — swap
// the <Check> row for a checkbox and add a Save action, without needing to
// touch the grouping/sorting logic itself.

type Permission = {
  code: string;
  name: string;
  description: string | null;
  module: string;
};

type RoleDetail = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: Permission[];
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  role: RoleDetail | null;
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  entities: 'Entities',
  'org-chart': 'Organization Chart',
  'governance-team': 'Governance Team',
  'board-meetings': 'Board Meetings',
  calendar: 'Calendar',
  compliance: 'Compliance',
  licenses: 'Licenses',
  'regulatory-capital': 'Regulatory Capital',
  alerts: 'Alerts',
  'document-vault': 'Document Vault',
  users: 'Users',
  roles: 'Roles',
  submissions: 'Submissions',
};

function moduleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module;
}

function groupByModule(permissions: Permission[]) {
  const byModule = new Map<string, Permission[]>();

  for (const permission of permissions) {
    const list = byModule.get(permission.module) ?? [];
    list.push(permission);
    byModule.set(permission.module, list);
  }

  return Array.from(byModule.entries())
    .map(([module, perms]) => ({
      module,
      label: moduleLabel(module),
      permissions: [...perms].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export default function RolePermissionViewer({ isOpen, onClose, role }: Props) {
  const grouped = role ? groupByModule(role.permissions) : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={role?.name ?? 'Role Permissions'}
      subtitle="Read-only permission overview"
      size="lg"
    >
      {!role ? null : (
        <div className="space-y-5">
          {role.description && (
            <p className="text-sm text-gray-600">{role.description}</p>
          )}

          {/* Role type + user count */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Role Type</span>
              {role.isSystem ? (
                <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                  Platform Managed
                </span>
              ) : (
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                  Custom Role
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">User Count</span>
              <span className="text-sm font-medium text-gray-900">{role.userCount}</span>
            </div>

            {role.isSystem && (
              <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                This built-in role is maintained by GovernanceOS and cannot be edited.
              </p>
            )}
          </div>

          {/* Permission summary */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Permission Summary</p>
            <p className="text-sm text-gray-700">
              {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'} across {grouped.length} module{grouped.length === 1 ? '' : 's'}
            </p>
          </div>

          {/* Grouped permissions */}
          <div className="space-y-4">
            {grouped.map(({ module, label, permissions }) => (
              <div key={module} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
                <ul className="space-y-1.5">
                  {permissions.map((permission) => (
                    <li key={permission.code} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      <span>{permission.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {grouped.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">
                No permissions are assigned to this role yet.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
