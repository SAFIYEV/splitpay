# SplitPay — Архитектурные решения

> Дополнение к [SPLITPAY_TECH_SPEC.md](SPLITPAY_TECH_SPEC.md).
> Отражает финальный согласованный стек. Где спека и этот документ расходятся — приоритет у этого документа.

## Отличия от исходной спеки v1.0

| Было (спека) | Стало | Причина |
|---|---|---|
| MongoDB + Mongoose | **PostgreSQL + Prisma** | Строгая типизация, JSONB, row-level security, ACID — для финансовых данных безопаснее |
| MongoDB Atlas | **AWS RDS PostgreSQL** | Управляемый продакшн |
| Upstash / Redis Cloud | **AWS ElastiCache Redis** | Единый провайдер с RDS |
| Railway/DO/Vercel | **Render** (backend Web Service + frontend Static Site) | Простой деплой, нативная поддержка Docker и статики |

## База данных

Prisma schema (нормализованная): `User`, `Group`, `GroupMember`, `Expense`, `ExpenseSplit`, `Settlement`, `Notification`.

- Денежные суммы: `Decimal @db.Decimal(19, 6)` (USDC — 6 decimals)
- ID: `String @id @default(uuid())`
- Вложенные массивы из Mongo-схемы (members, splits) вынесены в отдельные таблицы

## Инфраструктура

```
AWS EC2 (backend + frontend + nginx + Redis) ──► AWS RDS PostgreSQL ──► Solana Devnet (Helius)
```

- Локально: `docker-compose.yml` поднимает PostgreSQL 16 + Redis 7
- Прод: EC2 t3.medium (см. [DEPLOY.md](DEPLOY.md)); Redis — локальный на инстансе
  (очереди BullMQ + WS pub/sub); RDS доступен только с EC2-SG и IP владельца
- Ранее рассматривались Render + ElastiCache — отклонено: у ElastiCache нет
  публичного endpoint, а Render не умеет VPC peering в AWS; EC2 с локальным
  Redis проще и дешевле на текущем масштабе
