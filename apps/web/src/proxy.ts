import createMiddleware from 'next-intl/middleware';
import { routing } from './shared/i18n/routing';

// Next 16: бывший middleware.ts. Определяет локаль и перенаправляет "/" → "/ru" (или "/en" по Accept-Language)
export default createMiddleware(routing);

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
