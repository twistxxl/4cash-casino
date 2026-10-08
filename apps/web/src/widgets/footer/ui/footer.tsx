import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AUTHOR } from '@/shared/config';
import { Logo } from '@/shared/ui/logo';

export function Footer() {
  const t = useTranslations('footer');
  return (
    <footer className="px-4 pt-16 pb-8 sm:px-6">
      <div className="glass mx-auto flex max-w-7xl flex-col gap-6 rounded-3xl p-6 md:flex-row md:items-center md:justify-between">
        <div className="grid max-w-md gap-2">
          <Logo />
          <p className="text-sm text-muted-foreground">{t('about')}</p>
        </div>
        <div className="grid gap-2 md:justify-items-end">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-win opacity-50" />
              <span className="relative inline-flex size-2.5 rounded-full bg-win" />
            </span>
            {t('openToWork')}
          </span>
          <a
            href={AUTHOR.telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary"
          >
            <Send className="size-4" />
            Telegram <span className="font-mono font-semibold text-foreground">@{AUTHOR.telegram}</span>
          </a>
          <p className="text-xs text-muted-foreground/80">{t('disclaimer')}</p>
        </div>
      </div>
    </footer>
  );
}
