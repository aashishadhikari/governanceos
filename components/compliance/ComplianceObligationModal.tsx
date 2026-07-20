'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import {
  FormField,
  Input,
  Select,
  Textarea,
  Button,
} from '@/components/ui/FormField';
import type { Entity } from '@/lib/db/schema';
import { useToast } from '@/components/ui/ToastProvider';



interface Props {
  isOpen: boolean;
  onClose: () => void;
  entities: Entity[];
  onSaved?: () => void;

  obligation?: {
    id: string;
    entityId: string;
    requirementType: string;
    description?: string | null;
    regulator: string;
    recurrence: string;
    dueDate: string;
    owner?: string | null;
    filingReference?: string | null;
    jiraReference?: string | null;
    notes?: string | null;
  } | null;
}

/**
 * Form model used for creating a compliance obligation.
 * Mirrors the ComplianceObligation model and CSV import fields.
 */
interface ComplianceForm {
  entityId: string;
  requirementType: string;
  description: string;
  regulator: string;
  recurrence: string;
  dueDate: string;
  owner: string;
  filingReference: string;
  jiraReference: string;
  notes: string;
}

const FREQUENCY_OPTIONS = [
  { value: 'annual', label: 'Annual' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'ad_hoc', label: 'Ad Hoc' },
  { value: 'one_off', label: 'One-off' },
];

export default function ComplianceObligationModal({
  isOpen,
  onClose,
  entities,
  onSaved,
  obligation,
}: Props) {

  /**
   * Stores all user-entered obligation details.
   */
  const [form, setForm] = useState<ComplianceForm>({
    entityId: '',
    requirementType: '',
    description: '',
    regulator: '',
    recurrence: 'annual',
    dueDate: '',
    owner: '',
    filingReference: '',
    jiraReference: '',
    notes: '',
  });

  /**
   * Indicates whether the record is currently being saved.
   */
  const [saving, setSaving] = useState(false);

  /**
   * Shows the success confirmation screen after creation.
   */
  const [saved, setSaved] = useState(false);
  type UserOption = {
    id: string;
    name: string;
    email: string;
  };

  const [users, setUsers] = useState<UserOption[]>([]);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) return;

    if (obligation) {
      setForm({
        entityId: obligation.entityId,
        requirementType: obligation.requirementType,
        description: obligation.description ?? '',
        regulator: obligation.regulator,
        recurrence: obligation.recurrence,
        dueDate: obligation.dueDate.slice(0, 10),
        owner: obligation.owner ?? '',
        filingReference: obligation.filingReference ?? '',
        jiraReference: obligation.jiraReference ?? '',
        notes: obligation.notes ?? '',
      });
    } else {
      setForm({
        entityId: '',
        requirementType: '',
        description: '',
        regulator: '',
        recurrence: 'annual',
        dueDate: '',
        owner: '',
        filingReference: '',
        jiraReference: '',
        notes: '',
      });
    }

    setSaved(false);
  }, [isOpen, obligation]);

  //Added useEffect to load users from the API when the modal is opened
  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch('/api/users/active');

        if (!res.ok) return;

        const users = await res.json();

        setUsers(users);
      } catch (err) {
        console.error('Failed to load users', err);
      }
    }

    loadUsers();
  }, []);

  /**
   * Generic helper for updating form fields.
   */
  const set =
    (field: keyof ComplianceForm) =>
      (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
      ) =>
        setForm((prev) => ({
          ...prev,
          [field]: e.target.value,
        }));

  /**
   * Creates a new compliance obligation.
   * Validation is handled by the API.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);

    try {
      const res = await fetch(
        obligation
          ? `/api/compliance/${obligation.id}`
          : '/api/compliance',
        {
          method: obligation ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(form),
        });

      const json = await res.json();

      if (!res.ok) {
        toast.error(
          'Failed to save compliance obligation',
          json.error
        );
        return;
      }

      setSaved(true);

      setTimeout(() => {

        setSaved(false);

        onSaved?.();

        onClose();

        setForm({
          entityId: '',
          requirementType: '',
          description: '',
          regulator: '',
          recurrence: 'annual',
          dueDate: '',
          owner: '',
          filingReference: '',
          jiraReference: '',
          notes: '',
        });

      }, 1500);

    } catch (err) {

      toast.error(
        'Failed to save compliance obligation',
        err instanceof Error ? err.message : undefined
      );

    } finally {

      setSaving(false);

    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        saved
          ? 'Success'
          : obligation
            ? 'Edit Compliance Obligation'
            : 'New Compliance Obligation'
      }
      subtitle={
        saved
          ? (
            obligation
              ? 'Compliance obligation updated successfully.'
              : 'Compliance obligation created successfully.'
          )
          : (
            obligation
              ? 'Update the compliance obligation'
              : 'Create a regulatory filing or compliance obligation'
          )
      }
      size="lg"
    >
      {saved ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">

          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-5">
            <span className="text-3xl text-green-600">✓</span>
          </div>

          <h3 className="text-lg font-semibold text-gray-900">
            {obligation
              ? 'Compliance obligation updated successfully'
              : 'Compliance obligation created successfully'}
          </h3>

          <p className="mt-2 text-sm text-gray-500 max-w-md">
            {obligation
              ? 'Your changes have been saved successfully.'
              : 'The compliance obligation has been created and is now available in the register.'}
          </p>

          <p className="mt-6 text-xs text-gray-400">
            This window will close automatically...
          </p>

        </div>
      ) : (

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* General Information */}

          <div className="grid grid-cols-2 gap-4">

            <FormField
              label="Entity"
              required
            >
              <Select
                value={form.entityId}
                onChange={set('entityId')}
                required
                placeholder="Select entity"
                options={entities.map(entity => ({
                  value: entity.id,
                  label: entity.name,
                }))}
              />
            </FormField>

            <FormField
              label="Requirement"
              required
            >
              <Input
                placeholder="e.g. Annual Return"
                value={form.requirementType}
                onChange={set('requirementType')}
                required
              />
            </FormField>

            <FormField
              label="Regulator"
              required
            >
              <Input
                placeholder="e.g. MAS, FCA, ASIC"
                value={form.regulator}
                onChange={set('regulator')}
                required
              />
            </FormField>

            <FormField
              label="Recurrence"
              required
            >
              <Select
                value={form.recurrence}
                onChange={set('recurrence')}
                options={FREQUENCY_OPTIONS}
              />
            </FormField>

            <FormField
              label="Due Date"
              required
            >
              <Input
                type="date"
                value={form.dueDate}
                onChange={set('dueDate')}
                required
              />
            </FormField>

            <FormField
              label="Owner"
            >
              <Select
                value={form.owner}
                onChange={set('owner')}
                placeholder="Select owner"
                options={users.map(user => ({
                  value: user.name,
                  label: `${user.name} (${user.email})`,
                }))}
              />
            </FormField>

            <FormField
              label="Filing Reference"
            >
              <Input
                placeholder="Optional filing reference"
                value={form.filingReference}
                onChange={set('filingReference')}
              />
            </FormField>

            <FormField
              label="Jira Reference"
            >
              <Input
                placeholder="e.g. GRR-245"
                value={form.jiraReference}
                onChange={set('jiraReference')}
              />
            </FormField>

            <div />

            <FormField
              label="Description"
              className="col-span-2"
            >
              <Textarea
                placeholder="Describe the filing or compliance requirement..."
                value={form.description}
                onChange={set('description')}
              />
            </FormField>

            <FormField
              label="Notes"
              className="col-span-2"
            >
              <Textarea
                placeholder="Internal notes..."
                value={form.notes}
                onChange={set('notes')}
              />
            </FormField>

          </div>

          {/* Footer */}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">

            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              loading={saving}
            >
              {obligation ? 'Save Changes' : 'Create Obligation'}
            </Button>

          </div>

        </form>

      )}
    </Modal>
  );
}