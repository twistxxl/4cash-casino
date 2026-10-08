'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCurrentPlayer } from '@/entities/player';
import { CreatePlayerDialog } from '@/features/create-player';
import { PlayerPicker } from '@/features/select-player';
import { Link } from '@/shared/i18n';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Chips } from '@/shared/ui';
import { GameTiles } from '@/widgets/game-tiles';
import { LiveFeed } from '@/widgets/live-feed';

export function LobbyPage() {
  const t = useTranslations('lobby');
  const { hydrated, player } = useCurrentPlayer();

  return (
    <div className="grid gap-10">
      <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="grid gap-6">
          <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl xl:text-6xl">
            {t.rich('hero.title', {
              accent: (chunks) => (
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{chunks}</span>
              ),
            })}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t('hero.text')}</p>
          <div className="flex flex-wrap gap-3">
            {hydrated && player ? (
              <>
                <Button asChild size="lg">
                  <Link href="/crash">
                    {t('hero.playCrash')}
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="glass">
                  <Link href="/roulette">{t('hero.playRoulette')}</Link>
                </Button>
              </>
            ) : (
              <Button asChild size="lg">
                <a href="#pick">
                  {t('hero.pick')}
                  <ArrowRight />
                </a>
              </Button>
            )}
            <Button asChild size="lg" variant="ghost">
              <Link href="/about">{t('hero.how')}</Link>
            </Button>
          </div>
          {hydrated && player && (
            <p className="text-sm text-muted-foreground">
              {t.rich('hero.playingAs', {
                name: () => <span className="font-semibold text-foreground">{player.username}</span>,
                balance: () => <Chips value={player.balance} className="font-semibold text-primary" />,
              })}
            </p>
          )}
        </div>
        <LiveFeed limit={7} className="lg:max-h-[560px]" />
      </section>

      {hydrated && !player && (
        <section id="pick" className="scroll-mt-28">
          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">{t('pick.title')}</CardTitle>
                <CardDescription className="mt-1">{t('pick.text')}</CardDescription>
              </div>
              <CreatePlayerDialog />
            </CardHeader>
            <CardContent>
              <PlayerPicker />
            </CardContent>
          </Card>
        </section>
      )}

      <section className="grid gap-4">
        <h2 className="font-display text-xl font-bold">{t('games.title')}</h2>
        <GameTiles />
      </section>
    </div>
  );
}
