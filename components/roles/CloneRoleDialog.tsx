'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { FormField, Input, Textarea, Button } from '@/components/ui/FormField';

type SourceRole = {
  id: string;
  name: string;
  description: string | null;
};

type Permission = {
  code: string;
  name: string;
  description: string | null;
  module: string;
};

export type ClonedRole = {
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
  onCloned: (role: ClonedRole) => void;
  sourceRole: SourceRole | null;
}

const BLANK_FORM = { name: '', description: '' };

export default function CloneRoleDialog({ isOpen, onClose, onCloned, sourceRole }: Props) {
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !sourceRole) return;

    setForm({
      name: `${sourceRole.name} Copy`,
      description: sourceRole.description ?? '',
    });
    setError('');
  }, [isOpen, sourceRole]);

  const set = (field: keyof typeof BLANK_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceRole) return;

    setError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/roles/${sourceRole.id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(result?.error ?? 'Failed to clone role.');
        setSaving(false);
        return;
      }

      setSaving(false);
      onClose();
      onCloned(result as ClonedRole);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Failed to clone role.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Clone Role"
      subtitle={sourceRole ? `Based on "${sourceRole.name}"` : undefined}
      size="md"
    >
      {!sourceRole ? null : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <FormField label="Role Name" required>
            <Input placeholder="e.g. Legal Plus" value={form.name} onChange={set('name')} required />
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
            <Button type="submit" loading={saving}>Clone Role</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
