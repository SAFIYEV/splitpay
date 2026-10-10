# SplitPay — Деплой в продакшн

## Обзор

```
Render (splitpay-api + splitpay-web)
        │
        ▼
AWS: RDS PostgreSQL + ElastiCache Redis
        │
        ▼
Solana (devnet → mainnet) через Helius RPC + Webhooks
```

## 1. AWS: RDS PostgreSQL

1. RDS → Create database → PostgreSQL 16, template **Free tier** (`db.t3.micro`)
2. DB identifier: `splitpay`, master user: `splitpay`, пароль — сгенерировать и сохранить
3. Public access: **No** (Render подключается по приватному пути нельзя — поэтому: см. ниже про Security Group)
4. Security Group `splitpay-rds-sg`: inbound TCP 5432 с `0.0.0.0/0` + обязательно включить на RDS **SSL** и сильный пароль (Render не имеет фиксированных IP; альтернатива — Render Private Services, но для MVP достаточно TLS + пароль)
5. Endpoint вида `splitpay.xxxx.us-east-1.rds.amazonaws.com:5432`
6. `DATABASE_URL=postgresql://splitpay:PASSWORD@ENDPOINT:5432/splitpay?schema=public&sslmode=require`

## 2. AWS: ElastiCache Redis

1. ElastiCache → Create → Redis OSS, node `cache.t3.micro`, cluster mode disabled
2. Subnet group та же VPC; Security Group `splitpay-redis-sg`: inbound TCP 6379 (та же оговорка про доступ)
3. **Включить encryption in-transit** → подключение по TLS: `rediss://...`
4. `REDIS_URL=rediss://:AUTH@ENDPOINT:6379` (если включён auth token) или `redis://ENDPOINT:6379`

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

- [ ] RDS создан, `DATABASE_URL` проверен (`npx prisma migrate deploy` проходит)
- [ ] ElastiCache создан, `REDIS_URL` проверен
- [ ] Blueprint задеплоен, health check зелёный
- [ ] Program задеплоен на devnet, Program ID в env
- [ ] Helius webhook настроен и шлёт события
- [ ] Фронт открывается, логин/регистрация работают
- [ ] Mainnet-переход: USDC mint → `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`, RPC → Helius mainnet, программа → `anchor deploy --provider.cluster mainnet`
