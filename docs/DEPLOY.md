# SplitPay — Деплой в продакшн

## Обзор

```
Render (splitpay-api + splitpay-web + splitpay-redis)
        │
        ▼
AWS: RDS PostgreSQL (us-east-1)
        │
        ▼
Solana (devnet → mainnet) через Helius RPC + Webhooks
```

## 1. AWS: RDS PostgreSQL — УЖЕ СОЗДАН

Создан через AWS CLI (аккаунт 399033576582, регион us-east-1):

- Instance: `splitpay`, PostgreSQL 16.15, `db.t3.micro`, 20 GB gp3, publicly accessible
- Security group: `splitpay-rds-sg` (sg-05d30d6c7cf6e5fc7), inbound TCP 5432 с `0.0.0.0/0`
- Credentials: master user `splitpay`, пароль — в `.env.production.local` (не коммитится)
- `DATABASE_URL=postgresql://splitpay:PASSWORD@splitpay.cuvkme0m4zr0.us-east-1.rds.amazonaws.com:5432/splitpay?schema=public&sslmode=require`
- `rds.force_ssl=1` (default parameter group) — без SSL соединение отклоняется (проверено)
- Миграция `0001_init` уже применена (7 таблиц + `_prisma_migrations` с корректной checksum)

> Render не имеет фиксированных IP, поэтому SG открыт на 0.0.0.0/0 — защита через TLS (`sslmode=require`) + сильный пароль.

## 2. Redis: Render Key Value (НЕ ElastiCache)

**Почему не ElastiCache:** ElastiCache доступен только внутри VPC AWS — публичного endpoint у него нет и быть не может. Render не поддерживает VPC peering/PrivateLink в AWS на обычных планах, поэтому backend на Render физически не смог бы подключиться к ElastiCache.

Решение: **Render Key Value** (managed Redis) — нативно для Render, TLS, создаётся автоматически из `render.yaml` (сервис `splitpay-redis`, `REDIS_URL` подставляется через `fromService`).

Альтернатива, если принципиально держать Redis в AWS: перенести backend с Render на AWS App Runner с VPC connector — тогда ElastiCache работает. Это отдельная миграция, для MVP не нужна.

## 3. Render

1. Render Dashboard → **New → Blueprint** → подключить репозиторий `SAFIYEV/splitpay`
2. Render прочитает `render.yaml` и создаст два сервиса: `splitpay-api` (Docker) и `splitpay-web` (static)
3. Заполнить env vars со `sync: false`:
   - `splitpay-api`: `DATABASE_URL`, `REDIS_URL`, `SPLITPAY_PROGRAM_ID`, `HELIUS_API_KEY`, `HELIUS_WEBHOOK_SECRET`, `CORS_ORIGIN=https://splitpay-web.onrender.com`
   - `splitpay-web`: `VITE_API_URL=https://splitpay-api.onrender.com/api/v1`, `VITE_WS_URL=https://splitpay-api.onrender.com`, `VITE_SPLITPAY_PROGRAM_ID`
4. Первый деплой backend выполнит `prisma migrate deploy` (встроено в Dockerfile)
5. Health check: `https://splitpay-api.onrender.com/api/v1/health`

## 4. Solana program → devnet

Сборка программы требует Linux (на Windows — WSL2, см. `program/README.md`):

```bash
cd program
anchor build
anchor keys sync            # синхронизирует program id в declare_id! и Anchor.toml
anchor deploy --provider.cluster devnet
```

Полученный Program ID прописать в env: `SPLITPAY_PROGRAM_ID` (backend), `VITE_SPLITPAY_PROGRAM_ID` (frontend).

## 5. Helius webhook

1. Helius Dashboard → Webhooks → Create
2. Type: **Enhanced**, addresses: Program ID + USDC mint
3. URL: `https://splitpay-api.onrender.com/api/v1/webhooks/helius`
4. Secret сохранить в `HELIUS_WEBHOOK_SECRET`

## 6. Чеклист прод-деплоя

- [x] RDS создан, `DATABASE_URL` проверен (`npx prisma migrate deploy` проходит)
- [x] Redis: Render Key Value добавлен в render.yaml (создаётся автоматически)
- [ ] Blueprint задеплоен, health check зелёный
- [ ] Program задеплоен на devnet, Program ID в env
- [ ] Helius webhook настроен и шлёт события
- [ ] Фронт открывается, логин/регистрация работают
- [ ] Mainnet-переход: USDC mint → `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`, RPC → Helius mainnet, программа → `anchor deploy --provider.cluster mainnet`
