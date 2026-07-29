'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/FormField';
import { useToast } from '@/components/ui/ToastProvider';

// System roles: read-only. Custom roles: editable.
//
// State is intentionally split into `originalPermissions` (what the database
// has, refreshed whenever the modal opens) and `workingPermissions` (what the
// checkboxes currently show) — the role's fetched data is never mutated
// directly. This is what lets "Cancel" discard edits for free (just don't
// persist `workingPermissions`) and lets the Save button's disabled state be
// a pure comparison between the two sets.
//
// Rendering is split into a small `ModuleGroup` component so future,
// out-of-scope features (collapse/expand, select-all/clear per module,
// permission search) can be added to that one place without touching the
// state management above it.

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
  onSaved?: () => void;
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

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
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

interface ModuleGroupProps {
  label: string;
  permissions: Permission[];
  checked: Set<string>;
  editable: boolean;
  onToggle: (code: string) => void;
}

function ModuleGroup({ label, permissions, checked, editable, onToggle }: ModuleGroupProps) {
  const checkedCount = permissions.filter((p) => checked.has(p.code)).length;

  return (
    <div className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <p className="text-sm font-semibold text-gray-900 mb-2">
        {label} <span className="text-gray-400 font-normal">({checkedCount}/{permissions.length})</span>
      </p>
      <ul className="space-y-1.5">
        {permissions.map((permission) => (
          <li key={permission.code} className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={checked.has(permission.code)}
              disabled={!editable}
              onChange={() => onToggle(permission.code)}
              className="mt-0.5"
            />
            <span>{permission.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RolePermissionViewer({ isOpen, onClose, onSaved, role }: Props) {
  const toast = useToast();

  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [originalPermissions, setOriginalPermissions] = useState<Set<string>>(new Set());
  const [workingPermissions, setWorkingPermissions] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load the full catalog once — needed to render permissions the role does
  // NOT have yet (so they can be checked), not just the ones it already has.
  // `catalogLoading` is tracked explicitly rather than inferred from an empty
  // list, so a genuinely-empty response can't be confused with "still loading".
  useEffect(() => {
    async function loadPermissions() {
      try {
        const res = await fetch('/api/permissions');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) setAllPermissions(data);
      } catch (err) {
        console.error('Failed to load permission catalog', err);
      } finally {
        setCatalogLoading(false);
      }
    }

    loadPermissions();
  }, []);

  // Reset both permission sets from the database every time the modal opens
  // for a (possibly different) role — never mutate the role prop directly.
  useEffect(() => {
    if (!isOpen || !role) return;

    const codes = new Set(role.permissions.map((p) => p.code));
    setOriginalPermissions(codes);
    setWorkingPermissions(new Set(codes));
    setError('');
  }, [isOpen, role]);

  const editable = !!role && !role.isSystem;
  const isDirty = !setsEqual(originalPermissions, workingPermissions);

  const togglePermission = (code: string) => {
    if (!editable) return;
    setWorkingPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSave = async () => {
    if (!role) return;

    setError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/roles/${role.id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionCodes: Array.from(workingPermissions) }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        // originalPermissions/workingPermissions are left exactly as they
        // are — the user's in-progress edits and the error are shown together.
        setError(result?.error ?? 'Failed to update permissions.');
        setSaving(false);
        return;
      }

      setSaving(false);
      onClose();
      onSaved?.();
      toast.success('Permissions updated successfully.');
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Failed to update permissions.');
    }
  };

  const grouped = role ? groupByModule(allPermissions) : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={role?.name ?? 'Role Permissions'}
      subtitle={editable ? 'Edit assigned permissions' : 'Read-only permission overview'}
      size="lg"
    >
      {!role ? null : (
        <div className="space-y-5">
          {role.description && (
            <p className="text-sm text-gray-600">{role.description}</p>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Assigned</p>
            {catalogLoading ? (
              <p className="text-sm text-gray-400">Loading permissions...</p>
            ) : (
              <p className="text-sm font-medium text-gray-900">
                {workingPermissions.size} / {allPermissions.length} permissions
              </p>
            )}
          </div>

          {/* Grouped permissions */}
          <div className="space-y-4">
            {catalogLoading ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Loading permissions...
              </p>
            ) : (
              grouped.map(({ module, label, permissions }) => (
                <ModuleGroup
                  key={module}
                  label={label}
                  permissions={permissions}
                  checked={workingPermissions}
                  editable={editable}
                  onToggle={togglePermission}
                />
              ))
            )}

            {!catalogLoading && grouped.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">
                No permissions are available.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onClose}>
              {editable ? 'Cancel' : 'Close'}
            </Button>
            {editable && (
              <Button type="button" loading={saving} disabled={!isDirty} onClick={handleSave}>
                Save Changes
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
