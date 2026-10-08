# Один образ на все 8 сервисов: какой запустить — решает `command` в docker-compose.yml.
# TypeScript исполняется через ts-node (transpile-only) — для учебного стенда это проще сборки.
FROM node:22-alpine
WORKDIR /app
RUN npm install -g pnpm@10.23.0

# Сначала только манифесты — слой с зависимостями кешируется, пока они не меняются
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile --filter 4cash

COPY tsconfig.json ./
COPY libs ./libs
COPY scripts ./scripts
COPY apps ./apps
