'use client';

import { useOnboardingStore } from '@/store/onboarding-store';
import { IndividualCard } from './IndividualCard';
import { IndividualEditForm } from './IndividualEditForm';
import type { Individual } from '@/types/individual';

export function IndividualsList() {
  const { individuals, updateIndividual } = useOnboardingStore();

  function handleEdit(id: string) {
    updateIndividual(id, { isEditing: true });
  }

  async function handleSave(id: string, updates: Partial<Individual>) {
    const individual = individuals.find((ind) => ind.id === id);
    if (!individual) return;

    const entityId = individual.kycEntityId || individual.ownershipEntityId;
    if (entityId) {
      const res = await fetch('/api/entity/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          givenName: updates.givenName ?? individual.givenName,
          middleName: updates.middleName,
          familyName: updates.familyName ?? individual.familyName,
          dateOfBirth: updates.dateOfBirth,
          address: updates.address,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update entity');
      }
    }

    updateIndividual(id, { ...updates, isEditing: false });
  }

  function handleCancel(id: string) {
    updateIndividual(id, { isEditing: false });
  }

  if (individuals.length === 0) {
    return (
      <div className="text-center py-8 text-wise-gray-400 text-sm">
        No individuals found for this business.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {individuals.map((ind) =>
        ind.isEditing ? (
          <IndividualEditForm
            key={ind.id}
            individual={ind}
            onSave={(updates) => handleSave(ind.id, updates)}
            onCancel={() => handleCancel(ind.id)}
          />
        ) : (
          <IndividualCard key={ind.id} individual={ind} onEdit={() => handleEdit(ind.id)} />
        )
      )}
    </div>
  );
}
