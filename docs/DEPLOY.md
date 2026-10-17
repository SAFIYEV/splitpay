# SplitPay — продакшн-деплой (AWS)

## Обзор

```
Пользователь → https://52-87-49-59.sslip.io (nginx + Let's Encrypt)
                 ├─ /            → frontend (статика, /opt/splitpay/frontend/dist)
                 ├─ /api/v1/*    → backend (systemd splitpay-api, :3000)
                 └─ /socket.io/* → backend (WebSocket upgrade)
Backend → AWS RDS PostgreSQL (приватный SG) + локальный Redis
Solana: devnet (USDC 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU)
```

## Инфраструктура (аккаунт 399033576582, регион us-east-1)

| Компонент | Ресурс | Примечание |
|---|---|---|
| EC2 | `i-0416399ca76176d38` (t3.medium, Ubuntu 24.04) | EIP `52.87.49.59`, SG `splitpay-ec2-sg` (22/80/443), SSM-доступ (без SSH-ключей) |
| RDS | `splitpay` — PostgreSQL 16.15, db.t3.micro | SG `sg-05d30d6c7cf6e5fc7`: 5432 только с EC2-SG и IP владельца |
| Redis | локальный `redis-server` на EC2 (127.0.0.1) | очереди BullMQ + WS pub/sub |
| TLS | certbot + Let's Encrypt, домен `52-87-49-59.sslip.io` | авто-продление (`certbot renew` по таймеру) |

Доступ на инстанс: `aws ssm start-session --region us-east-1 --target i-0416399ca76176d38`
(на инстансе — IAM-профиль `splitpay-ec2-ssm-profile`, SSH-ключи не нужны).

Доступ к БД для просмотра (read-only) — см. [DATABASE.md](DATABASE.md).

## Раскладка на инстансе

- `/opt/splitpay` — git-репозиторий (ветка main, GitHub `SAFIYEV/splitpay`)
- `splitpay-api.service` — systemd, `User=ubuntu`, `EnvironmentFile=/opt/splitpay/backend/.env`, `ExecStart=node dist/main.js`, `Restart=always`
- nginx — `/etc/nginx/sites-enabled/splitpay`: статика + прокси /api и /socket.io, TLS от certbot
- npm 11 глобально (lock-файлы генерируются npm 11 — npm 10 их не принимает)

## Редеплой новой версии (вручную через SSM)

```bash
# 1. Обновить код и backend
cd /opt/splitpay && sudo -u ubuntu git pull --ff-only
cd backend && sudo -u ubuntu env HOME=/home/ubuntu npm ci --no-audit --no-fund
sudo -u ubuntu env HOME=/home/ubuntu npm run build
sudo -u ubuntu bash -c 'cd /opt/splitpay/backend && set -a && . ./.env && set +a && npx prisma migrate deploy'
sudo systemctl restart splitpay-api
curl -s http://127.0.0.1:3000/api/v1/health   # {"status":"ok","db":"up","redis":"up"}

# 2. Frontend (env уже в /opt/splitpay/frontend/.env)
cd /opt/splitpay/frontend
sudo -u ubuntu env HOME=/home/ubuntu npm ci --no-audit --no-fund
sudo -u ubuntu env HOME=/home/ubuntu npm run build   # dist/ обновляется сам, nginx подхватывает
```

## Solana program → devnet

Сборка только на Linux (CI). Workflow `.github/workflows/solana-program.yml`:
push в `program/**` → build + тесты; ручной запуск (`workflow_dispatch`,
`deploy_devnet=true`) → hardened-сборка (`--features usdc-allowlist`) и деплой.
Требуется секрет `SOLANA_DEPLOYER_KEYPAIR` в настройках репозитория.

После деплоя Program ID прописать:
- `/opt/splitpay/backend/.env` → `SPLITPAY_PROGRAM_ID` (+ `systemctl restart splitpay-api`)
- `/opt/splitpay/frontend/.env` → `VITE_SPLITPAY_PROGRAM_ID` (+ пересборка frontend)

## Helius webhook

1. Helius Dashboard → Webhooks → Create: тип **Enhanced**, addresses = Program ID + USDC mint
2. URL: `https://52-87-49-59.sslip.io/api/v1/webhooks/helius`
3. Secret — в `HELIUS_WEBHOOK_SECRET` (backend `.env`). Эндпоинт fail-closed:
   без секрета отвечает 401 в любом окружении.
4. Без webhook подтверждение платежей работает через BullMQ-поллинг (запасной канал).

## Прод-окружение backend (.env на инстансе)

`NODE_ENV=production`, `DATABASE_URL` (RDS, мастер-пароль — в `.env.production.local`),
`REDIS_URL=redis://127.0.0.1:6379`, `JWT_SECRET` (сильный, обязателен — код падает без него),
`CORS_ORIGIN=https://52-87-49-59.sslip.io`, `SOLANA_RPC_URL`, `USDC_MINT` (devnet),
`HELIUS_API_KEY`/`HELIUS_WEBHOOK_SECRET`, `SPLITPAY_PROGRAM_ID`.

## Масштабирование (цель: 5000 пользователей)

Текущих ресурсов (t3.medium + db.t3.micro) достаточно с запасом: это тысячи
пользователей и сотни одновременных соединений. Точки роста при превышении:
RDS → db.t3.small; EC2 → t3.large или вынос Redis на ElastiCache/Render KV;
backend за ALB в 2 инстанса (Redis-адаптер WS уже готов к multi-instance).

## Чеклист состояния

- [x] EC2 развёрнут, backend+frontend обновлены, HTTPS работает
- [x] RDS: пароль ротирован (17.10), read-only пользователь `splitpay_readonly`
- [x] RDS SG закрыт с интернета (только EC2 + IP владельца)
- [x] Smoke-тесты API end-to-end (17.10): auth, группы, расходы, расчёты, security-правила
- [ ] Program задеплоен на devnet, Program ID в env
- [ ] Helius webhook настроен
- [ ] Реальный devnet-платёж USDC через приложение (2 кошелька Phantom)
