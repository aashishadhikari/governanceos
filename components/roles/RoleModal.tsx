'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { FormField, Input, Textarea, Button } from '@/components/ui/FormField';

type RoleOption = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  role?: RoleOption | null;
}

const BLANK_FORM = {
  name: '',
  description: '',
};

export default function RoleModal({ isOpen, onClose, onSaved, role }: Props) {
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (role) {
      setForm({ name: role.name, description: role.description ?? '' });
    } else {
      setForm(BLANK_FORM);
    }

    setError('');
    setSaved(false);
  }, [isOpen, role]);

  const set = (field: keyof typeof BLANK_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
    setSaving(true);

    try {
      const res = await fetch(role ? `/api/roles/${role.id}` : '/api/roles', {
        method: role ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error ?? (role ? 'Failed to update role.' : 'Failed to create role.'));
        setSaving(false);
        return;
      }

      setSaving(false);
      setSaved(true);

      setTimeout(() => {
        setSaved(false);
        onSaved?.();
        onClose();
        if (!role) setForm(BLANK_FORM);
      }, 1500);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : (role ? 'Failed to update role.' : 'Failed to create role.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={role ? 'Edit Role' : 'Create Role'}
      subtitle={role ? role.name : 'Add a new role to the system'}
      size="md"
    >
      {saved ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center text-2xl">✓</div>
          <p className="font-semibold text-green-800">{role ? 'Role updated' : 'Role created successfully'}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <FormField label="Role Name" required>
            <Input placeholder="e.g. Compliance Officer" value={form.name} onChange={set('name')} required />
          </FormField>

          <FormField label="Description">
            <Textarea
              placeholder="Describe what this role can access..."
              value={form.description}
              onChange={set('description')}
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>{role ? 'Save Changes' : 'Create Role'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
