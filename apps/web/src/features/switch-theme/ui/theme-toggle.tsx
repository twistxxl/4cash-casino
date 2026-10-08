'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useHydrated } from '@/shared/lib';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui';

const OPTIONS = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
] as const;

export function ThemeToggle() {
  const t = useTranslations('header.theme');
  const { theme, resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  // До гидрации тема неизвестна (берётся из localStorage/системы) — рисуем нейтральную иконку
  const Icon = !hydrated ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="glass" size="icon" aria-label={t('label')}>
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {OPTIONS.map(({ value, icon: ItemIcon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)} className={theme === value ? 'font-semibold' : ''}>
            <ItemIcon />
            {t(value)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
