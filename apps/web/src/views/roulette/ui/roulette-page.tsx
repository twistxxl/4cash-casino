import { useTranslations } from 'next-intl';
import { SectionTitle } from '@/shared/ui/section-title';
import { PlayerGate } from '@/widgets/player-gate';
import { RouletteTable } from '@/widgets/roulette-table';

export function RoulettePage() {
  const t = useTranslations('roulette');
  return (
    <div className="grid gap-6">
      <SectionTitle title={t('title')} subtitle={t('subtitle')} />
      <PlayerGate>
        <RouletteTable />
      </PlayerGate>
    </div>
  );
}
