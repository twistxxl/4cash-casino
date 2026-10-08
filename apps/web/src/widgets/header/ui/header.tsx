'use client';

import { CircleDot, House, Info, TrendingUp, Trophy, Wallet, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PlayerSwitcher } from '@/features/select-player';
import { LocaleSwitcher } from '@/features/switch-locale';
import { ThemeToggle } from '@/features/switch-theme';
import { Link, usePathname } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Logo } from '@/shared/ui';
import { StreamIndicator } from './stream-indicator';

const NAV: Array<{ href: string; key: 'lobby' | 'roulette' | 'crash' | 'wallet' | 'leaderboard' | 'about'; icon: LucideIcon }> = [
  { href: '/', key: 'lobby', icon: House },
  { href: '/roulette', key: 'roulette', icon: CircleDot },
  { href: '/crash', key: 'crash', icon: TrendingUp },
  { href: '/wallet', key: 'wallet', icon: Wallet },
  { href: '/leaderboard', key: 'leaderboard', icon: Trophy },
  { href: '/about', key: 'about', icon: Info },
];

function NavLinks({ className, itemClassName }: { className?: string; itemClassName?: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <nav className={className}>
      {NAV.map(({ href, key, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground',
              active && 'bg-surface text-foreground shadow-sm',
              itemClassName,
            )}
          >
            <Icon className="size-4" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

export function Header() {
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-40 px-4 pt-3 sm:px-6">
      {/* шапка плотнее обычного стекла: под ней прокручивается крупный текст */}
      <div className="glass mx-auto flex max-w-7xl items-center gap-2 rounded-2xl px-2.5 py-2 [background:var(--glass-strong)] sm:gap-3 sm:px-3">
        <Link href="/" className="shrink-0 rounded-xl px-1 focus-visible:ring-2 focus-visible:ring-ring" aria-label="4cash">
          <Logo textClassName="hidden sm:inline" />
        </Link>
        <NavLinks className="ml-2 hidden items-center gap-0.5 xl:flex" />
        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <StreamIndicator />
          <LocaleSwitcher />
          <ThemeToggle />
          <PlayerSwitcher />
        </div>
      </div>
      <NavLinks className="glass mx-auto mt-2 flex max-w-7xl gap-0.5 overflow-x-auto rounded-2xl p-1 [background:var(--glass-strong)] [scrollbar-width:none] xl:hidden" />
    </header>
  );
}
