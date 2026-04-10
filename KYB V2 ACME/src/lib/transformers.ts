import { v4 as uuidv4 } from 'uuid';
import type { DirectorDTO, ShareholderDTO, PSCDetail, OfficerDTO, AustralianOfficeholder } from '@/types/business';
import type { Individual, IndividualRole } from '@/types/individual';

function parseName(fullName: string): { givenName: string; middleName?: string; familyName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { givenName: '', familyName: '' };
  if (parts.length === 1) return { givenName: parts[0], familyName: '' };
  if (parts.length === 2) return { givenName: parts[0], familyName: parts[1] };
  return {
    givenName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    familyName: parts[parts.length - 1],
  };
}

function mapAustralianRole(role?: string): IndividualRole {
  const r = (role || '').toUpperCase().trim();
  if (r === 'DR' || r === 'DIRECTOR') return 'director';
  if (r === 'SEC' || r === 'SECRETARY') return 'secretary';
  if (r === 'UBO') return 'ubo';
  if (r === 'SH' || r === 'SHAREHOLDER') return 'shareholder';
  return 'officer';
}

function normalizeNameForDedup(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

function parseDirectorAddress(d: DirectorDTO) {
  const parts = [d.address1, d.address2, d.address3, d.address4, d.address5, d.address6].filter(Boolean);
  return {
    streetAddress: parts.slice(0, -1).join(', ') || undefined,
    city: parts[parts.length - 1] || undefined,
    postalCode: d.postcode || undefined,
  };
}

export function extractDirectors(directors: DirectorDTO[]): Individual[] {
  return directors.map((d) => {
    const { givenName, middleName, familyName } = parseName(d.name || '');
    const address = parseDirectorAddress(d);
    return {
      id: uuidv4(),
      givenName,
      middleName,
      familyName,
      dateOfBirth: d.birthdate || undefined,
      nationality: d.nationality || undefined,
      address: Object.values(address).some(Boolean) ? address : undefined,
      roles: ['director'] as IndividualRole[],
      kycStatus: 'pending' as const,
    };
  });
}

export function extractShareholders(shareholders: ShareholderDTO[]): Individual[] {
  return shareholders
    .filter((s) => s.shareholderType !== 'CORPORATE' && s.shareholderType !== 'Corporate')
    .map((s) => {
      const { givenName, middleName, familyName } = parseName(s.name || '');
      return {
        id: uuidv4(),
        givenName,
        middleName,
        familyName,
        nationality: s.nationality || undefined,
        shareholdingPercentage: s.percentage || undefined,
        roles: ['shareholder'] as IndividualRole[],
        kycStatus: 'pending' as const,
      };
    });
}

export function extractPSCs(pscs: PSCDetail[]): Individual[] {
  return pscs
    .filter((p) => !p.CeasedOn)
    .map((p) => {
      const { givenName, middleName, familyName } = parseName(p.Name || '');
      let dob: string | undefined;
      let yearOfBirth: string | undefined;

      if (p.DOBYear && p.DOBMonth && p.DOBDay) {
        dob = `${p.DOBYear}-${String(p.DOBMonth).padStart(2, '0')}-${String(p.DOBDay).padStart(2, '0')}`;
      } else if (p.DOBYear && p.DOBMonth) {
        dob = `${p.DOBYear}-${String(p.DOBMonth).padStart(2, '0')}`;
        yearOfBirth = String(p.DOBYear);
      } else if (p.DOBYear) {
        yearOfBirth = String(p.DOBYear);
      }

      return {
        id: uuidv4(),
        givenName,
        middleName,
        familyName,
        dateOfBirth: dob,
        yearOfBirth,
        nationality: p.Nationality || undefined,
        address: p.Address ? { streetAddress: p.Address } : undefined,
        roles: ['psc'] as IndividualRole[],
        kycStatus: 'pending' as const,
      };
    });
}

export function extractOfficers(officers: OfficerDTO[]): Individual[] {
  return officers.map((o) => {
    const { givenName, middleName, familyName } = parseName(o.Name || '');
    return {
      id: uuidv4(),
      givenName,
      middleName,
      familyName,
      address: o.Address ? { streetAddress: o.Address } : undefined,
      roles: ['officer'] as IndividualRole[],
      kycStatus: 'pending' as const,
    };
  });
}

export function extractAustralianIndividuals(
  officeholders: AustralianOfficeholder[],
  ubos: AustralianOfficeholder[]
): Individual[] {
  const individuals: Individual[] = [];

  for (const oh of officeholders) {
    const { givenName, middleName, familyName } = parseName(oh.name || '');
    const addr = oh.addresses?.[0];
    individuals.push({
      id: uuidv4(),
      givenName,
      middleName,
      familyName,
      dateOfBirth: oh.dateOfBirth || undefined,
      kycEntityId: oh.entityId || undefined,
      address: addr
        ? {
            streetAddress: [addr.streetNumber, addr.streetName].filter(Boolean).join(' ') || addr.longForm,
            city: addr.suburb || addr.state,
            state: addr.state,
            postalCode: addr.postalCode,
            country: addr.country || 'AU',
          }
        : undefined,
      roles: [mapAustralianRole(oh.role)],
      kycStatus: 'pending',
    });
  }

  for (const ubo of ubos) {
    const { givenName, middleName, familyName } = parseName(ubo.name || '');
    const addr = ubo.addresses?.[0];
    individuals.push({
      id: uuidv4(),
      givenName,
      middleName,
      familyName,
      dateOfBirth: ubo.dateOfBirth || undefined,
      kycEntityId: ubo.entityId || undefined,
      address: addr
        ? {
            streetAddress: [addr.streetNumber, addr.streetName].filter(Boolean).join(' ') || addr.longForm,
            city: addr.suburb || addr.state,
            state: addr.state,
            postalCode: addr.postalCode,
            country: addr.country || 'AU',
          }
        : undefined,
      roles: ['ubo'],
      shareholdingPercentage: ubo.percentOwned ? String(ubo.percentOwned) : undefined,
      kycStatus: 'pending',
    });
  }

  return deduplicateIndividuals(individuals);
}

export function deduplicateIndividuals(individuals: Individual[]): Individual[] {
  const map = new Map<string, Individual>();

  for (const ind of individuals) {
    const key = normalizeNameForDedup(`${ind.givenName}${ind.familyName}`);
    if (!key) continue;

    const existing = map.get(key);
    if (existing) {
      const newRoles = ind.roles.filter((r) => !existing.roles.includes(r));
      existing.roles = [...existing.roles, ...newRoles];
      if (!existing.dateOfBirth && ind.dateOfBirth) existing.dateOfBirth = ind.dateOfBirth;
      if (!existing.yearOfBirth && ind.yearOfBirth) existing.yearOfBirth = ind.yearOfBirth;
      if (!existing.nationality && ind.nationality) existing.nationality = ind.nationality;
      if (!existing.address && ind.address) existing.address = ind.address;
      if (!existing.shareholdingPercentage && ind.shareholdingPercentage)
        existing.shareholdingPercentage = ind.shareholdingPercentage;
      if (!existing.kycEntityId && ind.kycEntityId)
        existing.kycEntityId = ind.kycEntityId;
    } else {
      map.set(key, { ...ind });
    }
  }

  return Array.from(map.values());
}
