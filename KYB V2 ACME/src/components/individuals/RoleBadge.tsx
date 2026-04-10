import { Badge } from '@/components/ui/Badge';
import type { IndividualRole } from '@/types/individual';

const roleConfig: Record<IndividualRole, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  director: { label: 'Director', variant: 'default' },
  shareholder: { label: 'Shareholder', variant: 'default' },
  ubo: { label: 'Ultimate Beneficial Owner', variant: 'default' },
  psc: { label: 'Person with Significant Control', variant: 'default' },
  officer: { label: 'Officer', variant: 'default' },
  secretary: { label: 'Secretary', variant: 'default' },
};

interface RoleBadgeProps {
  role: IndividualRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = roleConfig[role] || { label: role, variant: 'default' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
