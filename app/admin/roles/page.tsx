'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import RoleModal from '@/components/roles/RoleModal';
import DeleteRoleDialog from '@/components/roles/DeleteRoleDialog';
import { Plus, Search, RefreshCw, Pencil, Trash2 } from 'lucide-react';

type RoleOption = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

// GET /api/roles now returns userCount directly (Prisma _count.users),
// computed atomically with the role list itself.
type RoleRow = RoleOption & { userCount: number };

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<RoleRow | null>(null);

  const fetchRoles = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/roles');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to load roles.');
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Failed to load roles.');
      }

      setRoles(data);
    } catch (err) {
      console.error('Failed to load roles', err);
      setError(err instanceof Error ? err.message : 'Failed to load roles.');
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const openCreate = () => {
    setEditingRole(null);
    setModalOpen(true);
  };

  const openEdit = (role: RoleRow) => {
    setEditingRole(role);
    setModalOpen(true);
  };

  const openDelete = (role: RoleRow) => {
    if (role.isSystem) return;
    setDeletingRole(role);
    setDeleteOpen(true);
  };

  const filtered = roles.filter(role =>
    !search || role.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Header
        title="Role Management"
        subtitle={`${roles.length} role${roles.length === 1 ? '' : 's'} configured`}
      />
      <div className="px-8 py-6 space-y-6">

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search by role name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={fetchRoles}
            disabled={loading}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="ml-auto">
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Role
            </button>
          </div>
        </div>

        {/* Role table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading roles…</div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={fetchRoles}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Try again
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 font-medium">Role Name</th>
                  <th className="text-left px-6 py-3 font-medium">Description</th>
                  <th className="text-left px-6 py-3 font-medium">System</th>
                  <th className="text-left px-6 py-3 font-medium">Users</th>
                  <th className="text-left px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(role => (
                  <tr key={role.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{role.name}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {role.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {role.isSystem ? 'Yes' : 'No'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {role.userCount}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(role)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-gray-200 hover:text-blue-700 transition-colors"
                          title="Edit Role"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDelete(role)}
                          disabled={role.isSystem}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-gray-200 hover:text-red-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          title={role.isSystem ? 'System roles cannot be deleted' : 'Delete Role'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                      {roles.length === 0
                        ? 'No roles have been created yet.'
                        : `No roles match "${search}".`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <RoleModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchRoles}
        role={editingRole}
      />

      <DeleteRoleDialog
        isOpen={deleteOpen}
        role={deletingRole}
        onClose={() => setDeleteOpen(false)}
        onDeleted={fetchRoles}
      />
    </div>
  );
}
