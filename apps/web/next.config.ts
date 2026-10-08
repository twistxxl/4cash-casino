import path from 'node:path';
import type { NextConfig } from 'next';
// next-intl закреплён на 4.4.0: с 4.5 его плагин тянет @swc/core (для извлечения сообщений, которое
// здесь не используется), а нативный загрузчик SWC 1.16 отказывается работать на Windows, если на
// %LOCALAPPDATA% есть права у AppContainer-SID (их добавляют некоторые песочницы).
import createNextIntlPlugin from 'next-intl/plugin';

// Корень pnpm-монорепозитория: нужен, чтобы standalone-сборка нашла зависимости из общего node_modules
const monorepoRoot = path.join(process.cwd(), '../..');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default createNextIntlPlugin('./src/shared/i18n/request.ts')(nextConfig);
