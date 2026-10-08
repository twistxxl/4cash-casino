# 4cash

Демонстрационное казино (игровые фишки, никаких реальных денег) на NestJS-микросервисах и веб-интерфейс на Next.js.

- **Kafka** — журнал событий: ставки, их результаты, движение денег, антифрод.
- **RabbitMQ** — задачи и команды: выплаты с повторами и DLQ, уведомления, синхронные RPC-запросы.
- **PostgreSQL** — балансы и история (у каждого сервиса своя схема).
- **Next.js** — рулетка и краш, которые обновляются вживую по SSE прямо из Kafka и RabbitMQ.

## Автор

**Открыт к сотрудничеству.** Проектирую и пишу бэкенды на Node.js и NestJS: брокеры сообщений, распределённые транзакции, отказоустойчивость, наблюдаемость.

Telegram: [@m42dev](https://t.me/m42dev)

## Демонстрация

- **YouTube** — [Кликни](https://youtu.be/9o6Ucezi-XY)
- **Скриншот_1** — [Кликни](https://ibb.co/HDX0mWd3)
- **Скриншот_2** — [Кликни](https://ibb.co/GQhz0pdk)
- **Скриншот_3** — [Кликни](https://ibb.co/VcK9Wn4P)
- **Скриншот_4** — [Кликни](https://ibb.co/hRwdVTkp)
- **Скриншот_5** — [Кликни](https://ibb.co/wZTTk6xk)
- **Скриншот_6** — [Кликни](https://ibb.co/1YMywmVy)


## Быстрый старт

Нужен только Docker Desktop.

```bash
docker compose up -d --build
```

Через пару минут (первая сборка дольше) откройте **http://localhost:3001**: выберите демо-игрока и играйте.
Контейнер `init` сам создаст таблицы, топики, очереди и тестовых игроков — только в пустую базу, повторный запуск данные не трогает.

| Что | Где | Доступ |
|---|---|---|
| **Веб-интерфейс** | http://localhost:3001 | — |
| API gateway | http://localhost:3000 | запросы в [requests.http](requests.http) |
| Kafka UI | http://localhost:8080 | — |
| RabbitMQ Management | http://localhost:15672 | guest / guest |
| Adminer (PostgreSQL) | http://localhost:8081 | System: PostgreSQL, Server: `postgres`, fourcash / fourcash, DB: fourcash |

Чтобы интерфейс ожил, запустите в соседнем терминале симуляцию игроков (нужны Node 22+ и pnpm):

```bash
pnpm install
pnpm simulate duration=0
```

Остановить: `docker compose down`. Снести вместе с данными: `docker compose down -v`.

## Веб-интерфейс

`apps/web` — Next.js 16 (App Router), React 19, TypeScript.

- **Архитектура — Feature-Sliced Design.** Слои `core → views → widgets → features → entities → shared`, импорт только сверху вниз. Слои `app` и `pages` из FSD переименованы в `core` и `views`, потому что эти имена заняты роутингом Next.js; маршруты лежат в `src/app`.
- **Состояние:** серверные данные — TanStack Query; клиентские — Zustand (выбранный игрок в `localStorage`, живой раунд краша, лента ставок).
- **Живые данные — SSE** (`GET /events/stream`). Gateway держит собственную consumer group на каждый экземпляр (broadcast всех событий) и эфемерную очередь RabbitMQ, привязанную к exchange уведомлений. Все события превращаются в состояние в одном месте: `src/core/providers/live-events.tsx`.
- **Краш** рисуется на canvas: сервер присылает только «старт» и «краш», а кривую фронт считает сам по той же формуле, что и сервер. Число обновляется через `requestAnimationFrame` напрямую в DOM, без перерисовок React.
- **UI:** Tailwind CSS 4 + компоненты в стиле shadcn/ui на Radix, стеклянный стиль, светлая и тёмная темы (next-themes, «как в системе» по умолчанию).
- **i18n:** next-intl, `/ru` и `/en` в URL, ключи переводов типизированы. Закреплён next-intl 4.4.0 — почему, написано в `next.config.ts`.

## Архитектура бэкенда

```
                              HTTP :3000  + SSE
                            ┌─────────────┐
     браузер (Next.js) ───► │ api-gateway │ ◄── SSE: своя группа Kafka + эфемерная очередь RabbitMQ
                            └──┬───┬───┬──┘
       bets.placed (Kafka) ────┘   │   └──── RPC (RabbitMQ): wallet.rpc, crash.rpc
                                   └──────── RPC (Kafka): leaderboard.get
 ┌──────────────────────────────── KAFKA ─────────────────────────────────────┐
 │  bets.placed ──► wallet ──► bets.accepted ──► roulette ─┐                   │
 │       │          (БД +        bets.rejected   crash ────┤ ──► crash.rounds  │
 │       │          outbox)                                ▼                   │
 │       │            ▲ ◄──────────────────────────── bets.settled ──► leaderboard
 │       ▼            │ risk.alerts (BLOCK)                │                   │
 │     risk ◄─────────┼─────── wallet.transactions ◄── wallet                  │
 └────────────────────┼────────────────────────────────────────────────────────┘
 ┌────────────────────┼──────────── RABBITMQ ──────────────────────────────────┐
 │  wallet ──► payouts ──► payments ──► payouts.results ──► wallet             │
 │               ▲  │ временная ошибка → payouts.retry (TTL 5с) ─┘ назад        │
 │               │  └ 3 неудачи → payouts.dlq                                  │
 │  wallet, risk ──► exchange "notifications" (topic)                          │
 │                     push.* / email.* / admin.* → notifications-service      │
 │                     #       → notifications.audit, эфемерная очередь gateway│
 └─────────────────────────────────────────────────────────────────────────────┘
```

| Сервис | Брокеры | Что делает | Что на нём изучать |
|---|---|---|---|
| `api-gateway` | Kafka, RabbitMQ | HTTP API и SSE | `202 Accepted` для асинхронных операций; RPC через RabbitMQ и через Kafka; broadcast-консьюмер |
| `wallet-service` | Kafka, RabbitMQ, PG | Балансы, списание ставок, выигрыши, выводы | Транзакции и `FOR UPDATE`, **transactional outbox**, идемпотентность, гибридное Nest-приложение |
| `roulette-service` | Kafka, PG | Крутит европейскую рулетку | Stateless-консьюмер, масштабирование по партициям |
| `crash-service` | Kafka, RabbitMQ, PG | Игровой цикл краша | Синглтон с таймером, быстрый RPC (кэшаут), восстановление после падения |
| `risk-service` | Kafka, RabbitMQ, PG | Антифрод: 4 правила | Состояние в памяти + co-partitioning, event time, окна |
| `leaderboard-service` | Kafka | Топы, RTP, история краша | Проекция из событий, **replay**, дедупликация |
| `payments-service` | RabbitMQ | Выплаты через «провайдера» | Ручной ack/nack, prefetch, отложенный повтор, **DLQ** |
| `notifications-service` | RabbitMQ | push / email / admin | **Topic exchange**, routing key |

### Жизненный цикл ставки

```
POST /bets/roulette ─► bets.placed ─► wallet: хватает денег?
                                        ├─ нет ─► bets.rejected ─────────────► SSE "rejected"
                                        └─ да: −ставка + bets.accepted (outbox, одна транзакция)
                                                   └─► roulette ─► bets.settled ─► wallet: +выигрыш
                                                                         └───────► SSE "bet" → колесо крутится
```

### Жизненный цикл вывода

```
POST /players/:id/withdraw ─► (RPC) wallet: −деньги, withdrawal=pending, задача в outbox
   ─► payouts ─► payments ─► провайдер:  ok ──────► payouts.results ─► wallet: completed + email
                                     declined ───► payouts.results ─► wallet: failed, ВОЗВРАТ + email
                                     timeout ────► payouts.retry ─(5с)─► payouts ─► ... ─(3 раза)─► payouts.dlq
```

## Разработка

Инфраструктура в Docker, код — локально с hot reload:

```bash
pnpm install
pnpm infra:up       # только Kafka, Kafka UI, RabbitMQ, PostgreSQL, Adminer
pnpm infra:setup    # таблицы, топики, очереди (подождите ~15 сек после infra:up)
pnpm seed           # 60 игроков с разным поведением + 3 демо-игрока
pnpm dev            # 8 сервисов + Next.js (http://localhost:3001)
pnpm simulate       # во втором терминале: живой трафик
```

Если запущен полный стек в Docker, сначала остановите его (`docker compose down`): порты совпадают.

> `pnpm setup` (без `infra:`) — встроенная команда самого pnpm, она не запустит скрипт проекта.

Сервисы можно запускать по одному: `pnpm start:wallet`, `pnpm dev:web` и т.д. При первом старте сервисы могут один раз сами перезапуститься (`Restarting ...`) — это особенность `node --watch` на Windows. Ошибки `The group coordinator is not available` в первые секунды тоже нормальны.

PostgreSQL снаружи доступен на порту **5433** (5432 часто занят локальным Postgres).

### Скрипты данных

| Команда | Что делает |
|---|---|
| `pnpm seed [players=60] [ifEmpty=1]` | Очищает таблицы, создаёт игроков (детерминированно) и стартовые депозиты. **Останавливайте сервисы перед seed** |
| `pnpm simulate [duration=120] [speed=1] [players=N] [personas=bot,martingale]` | Игроки играют через HTTP API по своему характеру. `duration=0` — до Ctrl+C |
| `pnpm flood [bets=2000] [burst=1]` | Заливает ставки прямо в Kafka через kafkajs — для уроков про lag и event time |

Характеры игроков (`persona`):

| persona | Поведение | Что вызывает |
|---|---|---|
| casual | Редко, мелко, на цвет | фон |
| regular | Часто, рулетка + краш, иногда вывод | выплаты, повторы, DLQ |
| highroller | Ставки по 2–10 тыс. | `BIG_WIN`, `push.big_win` |
| martingale | Красное, удваивает после проигрыша | `MARTINGALE` |
| crash_lover | Только краш, ручной кэшаут | RabbitMQ RPC под нагрузкой |
| bot | Ставка каждые 200–400 мс | `HIGH_FREQUENCY` → блокировка |
| bonus_abuser | Депозит → чуть играет → вывод | `DEPOSIT_WITHDRAW` |
| demo | Не трогается симулятором | для ручной игры |

### Переменные окружения для экспериментов

| Переменная | Сервис | По умолчанию | Зачем |
|---|---|---|---|
| `PROVIDER_FAIL_RATE` | payments | 0.25 | Доля временных ошибок провайдера |
| `PROVIDER_DECLINE_RATE` | payments | 0.05 | Доля отказов |
| `PROVIDER_DOWN=1` | payments | — | Провайдер лежит: всё уходит в DLQ |
| `PREFETCH` | payments | 2 | Сколько выплат воркер берёт одновременно |
| `LEADERBOARD_GROUP` | leaderboard | leaderboard-service | Новое имя группы → replay с начала |
| `CRASH_BETTING_MS` | crash | 7000 | Длительность приёма ставок |
| `OUTBOX_INTERVAL_MS` | wallet | 100 | Как часто relay публикует outbox |

В PowerShell: `$env:PROVIDER_DOWN=1; pnpm start:payments` (сбросить: `Remove-Item Env:PROVIDER_DOWN`).

## Структура

```
apps/
  api-gateway/ … notifications-service/   8 NestJS-сервисов
  web/                                     Next.js (FSD): src/app — маршруты, src/core … src/shared — слои
libs/common/src/
  messaging.ts             все топики, очереди, exchange, паттерны — начните читать отсюда
  events.ts                контракты сообщений
  schema.ts                SQL-схема
  transports.ts            фабрики Kafka/RabbitMQ серверов и клиентов
  resilient-kafka.server.ts  Kafka-сервер Nest, который переживает рестарт брокера
scripts/                   setup, seed, simulate, flood, personas
docker/                    Dockerfile бэкенда (один образ на все сервисы) и фронта (standalone)
```

