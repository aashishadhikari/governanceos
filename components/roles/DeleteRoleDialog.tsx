'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/FormField';

type RoleOption = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

interface Props {
  isOpen: boolean;
  role: RoleOption | null;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteRoleDialog({ isOpen, role, onClose, onDeleted }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) setError('');
  }, [isOpen, role]);

  const handleDelete = async () => {
    if (!role) return;

    setError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(result.error ?? 'Failed to delete role.');
        setSaving(false);
        return;
      }

      setSaving(false);
      onClose();
      onDeleted();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Failed to delete role.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} title="Delete Role" size="sm">
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <p className="text-sm text-gray-600 leading-6">
            Are you sure you want to delete{' '}
            <span className="font-medium text-gray-900">
              "{role?.name}"
            </span>
            ?
          </p>
          <p className="mt-3 text-xs text-gray-500">
            This action cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="danger" loading={saving} onClick={handleDelete}>
            {saving ? 'Deleting…' : 'Delete Role'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
