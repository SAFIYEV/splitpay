# SplitPay — доступ к базе данных (read-only)

Продакшн-БД: PostgreSQL 16 на AWS RDS (`splitpay`, регион us-east-1).
Порт 5432 открыт **только** для EC2-инстанса backend и домашнего IP владельца
(security group `sg-05d30d6c7cf6e5fc7`).

## Подключение (DBeaver / TablePlus / pgAdmin / DataGrip)

| Параметр | Значение |
|---|---|
| Host | `splitpay.cuvkme0m4zr0.us-east-1.rds.amazonaws.com` |
| Port | `5432` |
| Database | `splitpay` |
| User | `splitpay_readonly` |
| Password | хранится в `.env.production.local` (не коммитится) |
| SSL mode | `require` (RDS отклоняет соединения без TLS) |

Пользователь `splitpay_readonly` имеет только `SELECT` — ничего сломать
запросами нельзя. Мастер-доступ (`splitpay`) — только для backend и миграций.

> Если домашний IP сменится — добавь новый в SG:
> `aws ec2 authorize-security-group-ingress --region us-east-1 --group-id sg-05d30d6c7cf6e5fc7 --ip-permissions IpProtocol=tcp,FromPort=5432,ToPort=5432,IpRanges='[{CidrIp=НОВЫЙ_IP/32,Description="Marat home"}]'`

## Готовые запросы

### Пользователи

```sql
-- Всего пользователей и сколько с привязанными кошельками
SELECT count(*)                                        AS users_total,
       count("walletAddress")                          AS with_wallet,
       round(100.0 * count("walletAddress") / count(*), 1) AS wallet_pct
FROM "User";

-- Регистрации по дням
SELECT date_trunc('day', "createdAt")::date AS day, count(*) AS new_users
FROM "User"
GROUP BY 1 ORDER BY 1 DESC;

-- Кошельки: кто и когда привязал
SELECT "displayName", "walletAddress", "createdAt"
FROM "User"
WHERE "walletAddress" IS NOT NULL
ORDER BY "createdAt" DESC;
```

### Активность (группы и расходы)

```sql
-- Группы и расходы по дням
SELECT date_trunc('day', "createdAt")::date AS day,
       count(*) AS new_groups
FROM "Group" GROUP BY 1 ORDER BY 1 DESC;

SELECT date_trunc('day', "createdAt")::date AS day,
       count(*) AS expenses,
       sum("amount") AS amount_usdc
FROM "Expense" GROUP BY 1 ORDER BY 1 DESC;
```

### Расчёты (settlements): суммы, статусы, когда

```sql
-- По статусам: сколько и на какую сумму
SELECT "status", count(*) AS cnt, sum("amount") AS amount_usdc
FROM "Settlement"
GROUP BY "status"
ORDER BY amount_usdc DESC NULLS LAST;

-- Завершённые расчёты по дням (оборот)
SELECT date_trunc('day', "completedAt")::date AS day,
       count(*) AS settlements,
       sum("amount") AS settled_usdc
FROM "Settlement"
WHERE "status" = 'completed'
GROUP BY 1 ORDER BY 1 DESC;

-- On-chain (с tx-подписью) vs off-chain расчёты
SELECT CASE WHEN "solanaTransactionId" IS NOT NULL THEN 'on-chain' ELSE 'off-chain' END AS kind,
       count(*) AS cnt,
       sum("amount") AS amount_usdc
FROM "Settlement"
WHERE "status" = 'completed'
GROUP BY 1;

-- Последние расчёты с участниками
SELECT s."createdAt",
       uf."displayName" AS from_user,
       ut."displayName" AS to_user,
       s."amount",
       s."status",
       s."solanaTransactionId"
FROM "Settlement" s
JOIN "User" uf ON uf.id = s."fromUserId"
JOIN "User" ut ON ut.id = s."toUserId"
ORDER BY s."createdAt" DESC
LIMIT 50;
```

### Топ пользователей

```sql
-- По объёму проведённых расчётов (плательщики)
SELECT u."displayName", u."walletAddress",
       count(*) AS payments,
       sum(s."amount") AS paid_usdc
FROM "Settlement" s
JOIN "User" u ON u.id = s."fromUserId"
WHERE s."status" = 'completed'
GROUP BY u.id, u."displayName", u."walletAddress"
ORDER BY paid_usdc DESC
LIMIT 20;
```

## Схема данных

`User` (пользователи, `walletAddress` — привязанный кошелёк) ·
`Group` / `GroupMember` · `Expense` / `ExpenseSplit` ·
`Settlement` (расчёты: `amount` в USDC, `status`, `solanaTransactionId` — подпись
транзакции Solana, `createdById` — кто создал запись) · `Notification`.

Все суммы — `Decimal(19,6)`, т.е. уже в USDC (не micro-units).
