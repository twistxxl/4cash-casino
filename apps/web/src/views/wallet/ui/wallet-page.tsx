import { useTranslations } from 'next-intl';
import { SectionTitle } from '@/shared/ui/section-title';
import { PlayerGate } from '@/widgets/player-gate';
import { WalletOverview } from '@/widgets/wallet-overview';

export function WalletPage() {
  const t = useTranslations('wallet');
  return (
    <div className="grid gap-6">
      <SectionTitle title={t('title')} subtitle={t('subtitle')} />
      <PlayerGate>
        <WalletOverview />
      </PlayerGate>
    </div>
  );
}
