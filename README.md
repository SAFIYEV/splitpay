# SplitPay

Мобильное PWA-приложение для разделения групповых расходов с мгновенным погашением долгов через USDC на Solana.

## Стек

| Компонент | Технология |
|-----------|-----------|
| Frontend | Vue 3 + TypeScript + Framework7 + Tailwind + Pinia |
| Backend | NestJS + Prisma + PostgreSQL |
| Кэш/Очереди | Redis (BullMQ, Socket.io adapter) |
| Blockchain | Solana (Anchor) + USDC (SPL Token) + Helius |
| Инфраструктура | Render (backend/frontend) + AWS RDS + ElastiCache |

## Структура

```
splitpay/
├── frontend/    # Vue 3 + Framework7 PWA
├── backend/     # NestJS API + Prisma
├── program/     # Anchor Solana program
├── docs/        # Спецификация и архитектура
└── docker-compose.yml  # PostgreSQL + Redis для локальной разработки
```

## Быстрый старт (локальная разработка)

```bash
# 1. Поднять PostgreSQL и Redis
docker compose up -d

# 2. Настроить env
cp .env.example backend/.env
cp .env.example frontend/.env

# 3. Backend
cd backend
npm install
npx prisma migrate dev
npm run start:dev

# 4. Frontend
cd frontend
npm install
npm run dev
```

## Документация

- [Техническая спецификация](docs/SPLITPAY_TECH_SPEC.md)
- [Архитектурные решения](docs/ARCHITECTURE.md)
- [Деплой в продакшн (Render + AWS)](docs/DEPLOY.md)
- [Solana program: сборка и деплой](program/README.md)
