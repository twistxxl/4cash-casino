import { useTranslations } from 'next-intl';
import { TelegramContact } from '@/features/contact-author';
import { Card, CardContent } from '@/shared/ui/card';

/** «Открыт к сотрудничеству» — блок автора проекта */
export function AuthorCard() {
  const t = useTranslations('author');
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-accent/25 blur-3xl" aria-hidden />
      <CardContent className="relative grid gap-5 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
        <div className="grid gap-3">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-win/14 px-3 py-1 text-xs font-bold uppercase tracking-wider text-win">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-win opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-win" />
            </span>
            {t('badge')}
          </span>
          <h2 className="font-display text-2xl font-bold text-balance sm:text-3xl">{t('title')}</h2>        </div>
        <TelegramContact size="lg" />
      </CardContent>
    </Card>
  );
}
