import { useTranslations } from 'next-intl';
import { SectionTitle } from '@/shared/ui/section-title';
import { CrashGame } from '@/widgets/crash-game';
import { PlayerGate } from '@/widgets/player-gate';

export function CrashPage() {
  const t = useTranslations('crash');
  return (
    <div className="grid gap-6">
      <SectionTitle title={t('title')} subtitle={t('subtitle')} />
      <PlayerGate>
        <CrashGame />
      </PlayerGate>
    </div>
  );
}
