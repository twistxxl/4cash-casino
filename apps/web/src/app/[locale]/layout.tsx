import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import '@fontsource-variable/rubik';
import { Providers } from '@/core';
import '@/core/styles/globals.css';
import { routing } from '@/shared/i18n';
import { Footer } from '@/widgets/footer';
import { Header } from '@/widgets/header';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en', namespace: 'meta' });
  return {
    title: { default: '4cash', template: '%s · 4cash' },
    description: t('description'),
    applicationName: '4cash',
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e9f3fc' },
    { media: '(prefers-color-scheme: dark)', color: '#050f1c' },
  ],
};

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <Providers>
            <Header />
            <main className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8">{children}</main>
            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
