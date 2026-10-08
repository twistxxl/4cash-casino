'use client';

import { useTranslations } from 'next-intl';
import type { Persona, PlayerStatus } from '@/shared/api';
import { Badge } from '@/shared/ui/badge';

export function PersonaBadge({ persona }: { persona: Persona | null }) {
  const t = useTranslations('player.persona');
  if (!persona) return null;
  return <Badge variant={persona === 'demo' ? 'default' : 'muted'}>{t(persona)}</Badge>;
}

export function StatusBadge({ status }: { status: PlayerStatus }) {
  const t = useTranslations('player.status');
  if (status === 'active') return null;
  return <Badge variant="loss">{t(status)}</Badge>;
}
