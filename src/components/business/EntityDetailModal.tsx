'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

interface EntityDetailModalProps {
  entityId: string;
  entityName: string;
  entityType: 'individual' | 'organisation' | 'company';
  role?: string;
  percentage?: number;
  onClose: () => void;
  onUpdated?: () => void;
}

interface EntityForm {
  givenName: string;
  middleName: string;
  familyName: string;
  dateOfBirth: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export function EntityDetailModal({
  entityId,
  entityName,
  entityType,
  role,
  percentage,
  onClose,
  onUpdated,
}: EntityDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EntityForm>({
    givenName: '',
    middleName: '',
    familyName: '',
    dateOfBirth: '',
    streetAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });

  const isIndividual = entityType === 'individual';

  const fetchEntity = useCallback(async () => {
    if (!isIndividual) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/entity/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load entity details');
        return;
      }
      setForm({
        givenName: data.givenName || '',
        middleName: data.middleName || '',
        familyName: data.familyName || '',
        dateOfBirth: data.dateOfBirth || '',
        streetAddress: data.address?.streetAddress || '',
        city: data.address?.city || '',
        state: data.address?.state || '',
        postalCode: data.address?.postalCode || '',
        country: data.address?.country || '',
      });
    } catch {
      setError('Network error loading entity details');
    } finally {
      setLoading(false);
    }
  }, [entityId, isIndividual]);

  useEffect(() => {
    fetchEntity();
  }, [fetchEntity]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.givenName || !form.familyName) {
      setError('Given name and family name are required');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload: Record<string, unknown> = {
        entityId,
        givenName: form.givenName,
        familyName: form.familyName,
        middleName: form.middleName || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
      };

      if (form.streetAddress || form.city || form.state || form.postalCode || form.country) {
        payload.address = {
          streetAddress: form.streetAddress || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          postalCode: form.postalCode || undefined,
          country: form.country || undefined,
        };
      }

      const res = await fetch('/api/entity/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update entity');
        return;
      }

      setSuccess('Entity updated successfully');
      setEditing(false);
      onUpdated?.();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof EntityForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-wise-gray-200 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-wise-navy text-lg">{entityName}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {role && <span className="text-xs text-wise-gray-500">{role}</span>}
                {percentage != null && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    {percentage}%
                  </span>
                )}
                <span className="text-[10px] text-wise-gray-400 uppercase">{entityType}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wise-gray-100 transition-colors"
            >
              <svg className="w-4 h-4 text-wise-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : !isIndividual ? (
            <div className="text-sm text-wise-gray-500 py-4">
              <p>Organisation entity details are read-only.</p>
              <div className="mt-3 space-y-2">
                <div><span className="text-wise-gray-400">Entity ID:</span> <span className="font-mono text-xs">{entityId}</span></div>
              </div>
            </div>
          ) : editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="edit-givenName"
                  label="Given Name *"
                  value={form.givenName}
                  onChange={(e) => updateField('givenName', e.target.value)}
                />
                <Input
                  id="edit-familyName"
                  label="Family Name *"
                  value={form.familyName}
                  onChange={(e) => updateField('familyName', e.target.value)}
                />
              </div>
              <Input
                id="edit-middleName"
                label="Middle Name"
                value={form.middleName}
                onChange={(e) => updateField('middleName', e.target.value)}
              />
              <Input
                id="edit-dob"
                label="Date of Birth"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => updateField('dateOfBirth', e.target.value)}
              />

              <div className="border-t border-wise-gray-100 pt-4 mt-4">
                <h4 className="text-sm font-semibold text-wise-navy mb-3">Address</h4>
                <div className="space-y-3">
                  <Input
                    id="edit-street"
                    label="Street Address"
                    value={form.streetAddress}
                    onChange={(e) => updateField('streetAddress', e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      id="edit-city"
                      label="City / Town"
                      value={form.city}
                      onChange={(e) => updateField('city', e.target.value)}
                    />
                    <Input
                      id="edit-state"
                      label="State"
                      value={form.state}
                      onChange={(e) => updateField('state', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      id="edit-postalCode"
                      label="Postal Code"
                      value={form.postalCode}
                      onChange={(e) => updateField('postalCode', e.target.value)}
                    />
                    <Input
                      id="edit-country"
                      label="Country"
                      value={form.country}
                      onChange={(e) => updateField('country', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
              )}
              {success && (
                <div className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">{success}</div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setEditing(false); setError(''); }} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving || !form.givenName || !form.familyName}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Given Name" value={form.givenName} />
                <DetailField label="Family Name" value={form.familyName} />
              </div>
              {form.middleName && <DetailField label="Middle Name" value={form.middleName} />}
              <DetailField label="Date of Birth" value={form.dateOfBirth || 'Not provided'} />

              {(form.streetAddress || form.city || form.state || form.postalCode || form.country) && (
                <div className="border-t border-wise-gray-100 pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-wise-navy mb-3">Address</h4>
                  <div className="space-y-2">
                    {form.streetAddress && <DetailField label="Street" value={form.streetAddress} />}
                    <div className="grid grid-cols-2 gap-4">
                      {form.city && <DetailField label="City" value={form.city} />}
                      {form.state && <DetailField label="State" value={form.state} />}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {form.postalCode && <DetailField label="Postal Code" value={form.postalCode} />}
                      {form.country && <DetailField label="Country" value={form.country} />}
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-wise-gray-100 pt-3 mt-3">
                <span className="text-[10px] text-wise-gray-400">Entity ID: <span className="font-mono">{entityId}</span></span>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
              )}
              {success && (
                <div className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">{success}</div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Close
                </Button>
                <Button type="button" className="flex-1" onClick={() => { setEditing(true); setSuccess(''); }}>
                  Edit Details
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[11px] text-wise-gray-400 block">{label}</span>
      <span className="text-sm text-wise-navy font-medium">{value || '-'}</span>
    </div>
  );
}
