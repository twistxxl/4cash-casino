import { useTranslations } from 'next-intl';
import { SectionTitle } from '@/shared/ui/section-title';
import { LeaderboardBoard } from '@/widgets/leaderboard-board';

export function LeaderboardPage() {
  const t = useTranslations('leaderboard');
  return (
    <div className="grid gap-6">
      <SectionTitle title={t('title')} subtitle={t('subtitle')} />
      <LeaderboardBoard />
    </div>
  );
}
