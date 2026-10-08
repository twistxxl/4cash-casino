import { useTranslations } from 'next-intl';
import { Link } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';

export default function NotFound() {
  const t = useTranslations('notFound');
  return (
    <div className="glass mx-auto grid max-w-lg justify-items-center gap-4 rounded-3xl p-10 text-center">
      <p className="font-display text-6xl font-bold text-primary">404</p>
      <h1 className="font-display text-xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('text')}</p>
      <Button asChild>
        <Link href="/">{t('home')}</Link>
      </Button>
    </div>
  );
}
