import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/shared/i18n';
import { LobbyPage } from '@/views/lobby';

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LobbyPage />;
}