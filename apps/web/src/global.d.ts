import type messages from '../messages/ru.json';
import type { routing } from './shared/i18n/routing';

// Типизация next-intl: опечатка в ключе перевода — ошибка компиляции, а не пустая строка в UI
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
