# SplitPay — Техническая спецификация

> Версия: 1.0  
> Дата: 2026-07-01  
> Статус: Черновик  

---

## 1. Обзор проекта

### 1.1 Концепция

SplitPay — мобильное PWA-приложение для разделения групповых расходов с мгновенным погашением долгов через USDC на Solana.

**Ценность для пользователя:**
- Не нужно вручную считать, кто кому должен
- Не нужно мучиться с банковскими переводами между разными странами
- Мгновенное погашение долга в USDC через Solana (копеечные комиссии)
- Прозрачность: все транзакции видны всем участникам группы

### 1.2 Пользовательский flow

```
Создал группу → Добавил расходы → Приложение посчитало долги → 
Люди оплатили друг другу в USDC
```

### 1.3 Целевая аудитория

- Группы друзей, путешествующие вместе
- Соседи по квартире (shared expenses)
- Команды в поездках/воркшопах
- Международные группы (разные валюты → USDC)

---

## 2. Технологический стек

### 2.1 Фронтенд (Mobile PWA)

| Технология | Назначение |
|-----------|------------|
| **Vue.js 3** (Composition API + `<script setup>`) | Основной фреймворк |
| **TypeScript** | Типизация |
| **Framework7** | Нативный UI-кит для PWA (iOS/Android стили) |
| **Tailwind CSS** | Кастомные стили поверх Framework7 |
| **Pinia** | Управление состоянием |
| **Vue Router** | Навигация |
| **@solana/kit** | Solana RPC, транзакции, USDC |
| **Wallet Standard** | Подключение Phantom/Solflare/Backpack |
| **Vite** | Сборка |

### 2.2 Бэкенд (API)

| Технология | Назначение |
|-----------|------------|
| **NestJS** + TypeScript | Backend framework |
| **MongoDB** + Mongoose | Основная база данных |
| **Redis** | Кэш + очереди + WebSocket pub/sub |
| **Socket.io** | Real-time уведомления (расходы, платежи) |
| **Passport.js** | JWT + Wallet signature auth |
| **Bull** | Очереди задач (проверка платежей) |
| **Helius Webhooks** | Мониторинг Solana транзакций |

### 2.3 Solana (On-chain)

| Технология | Назначение |
|-----------|------------|
| **Anchor** | Фреймворк для Solana программы |
| **Rust** | Язык программы |
| **@solana/kit** | Клиентское SDK |
| **SPL Token** | USDC (Token-2022 или classic Token) |
| **Helius RPC** | RPC провайдер |
| **Devnet / Mainnet** | Сети |

### 2.4 Архитектурная диаграмма

```
┌─────────────────────────────────────┐
│         Mobile PWA (Vue + F7)        │
│  ┌─────────┐ ┌────────┐ ┌────────┐  │
│  │ Groups  │ │Expenses│ │Wallet  │  │
│  │  UI     │ │  UI    │ │Connect │  │
│  └────┬────┘ └───┬────┘ └───┬────┘  │
│       │          │         │        │
│  ┌────┴──────────┴─────────┴────┐   │
│  │     Pinia Store + API Client  │   │
│  └────────────┬──────────────────┘   │
└───────────────┼──────────────────────┘
                │ REST + WebSocket
                ▼
┌───────────────────────────────────────┐
│         NestJS Backend                │
│  ┌─────────┐ ┌───────┐ ┌──────────┐  │
│  │ Auth    │ │Groups │ │Payments  │  │
│  │ Module  │ │Module │ │ Module   │  │
│  └─────────┘ └───────┘ └──────────┘  │
│  ┌──────────────────────────────┐     │
│  │     Settlement Engine        │     │
│  └──────────────┬───────────────┘     │
│                 │                     │
│  ┌──────────────┴───────────────┐     │
│  │  MongoDB (Users, Groups,     │     │
│  │  Expenses, Settlements)      │     │
│  └──────────────────────────────┘     │
└──────────────┬────────────────────────┘
               │ Helius Webhooks
               ▼
┌───────────────────────────────────────┐
│         Solana Program (Anchor)       │
│  ┌──────────┐ ┌────────┐ ┌─────────┐ │
│  │ Expense  │ │Settle- │ │USDC     │ │
│  │ Group    │ │ment    │ │CPI      │ │
│  │ (PDA)    │ │(PDA)   │ │         │ │
│  └──────────┘ └────────┘ └─────────┘ │
└───────────────────────────────────────┘
```

---

## 3. База данных (MongoDB)

### 3.1 Схемы

```typescript
// ============ Users ============
{
  _id: ObjectId,
  email: string,                  // unique, optional
  displayName: string,
  avatar?: string,
  walletAddress: string,          // Solana публичный ключ
  authMethods: {
    email: boolean,               // email+password auth
    wallet: boolean,              // wallet signature auth
    google?: string,              // Google OAuth ID
  },
  passwordHash?: string,          // bcrypt (если email auth)
  verified: boolean,              // email verified?
  createdAt: Date,
  updatedAt: Date,
}

// ============ Groups ============
{
  _id: ObjectId,
  name: string,
  description?: string,
  photo?: string,
  currency: string,               // "USDC" (default)
  members: [{
    userId: ObjectId,             // ссылка на User
    role: "admin" | "member",
    joinedAt: Date,
    nickname?: string,            // имя в группе
  }],
  totalSpent: number,             // сумма всех расходов (в USDC)
  status: "active" | "archived",
  solanaGroupPDA?: string,        // адрес PDA группы на Solana
  metadata: {
    inviteCode: string,           // код для приглашения
    splitMethod: "equal" | "percentage" | "custom",
  },
  createdAt: Date,
  updatedAt: Date,
}

// ============ Expenses ============
{
  _id: ObjectId,
  groupId: ObjectId,              // ссылка на Group
  paidBy: ObjectId,               // кто оплатил (userId)
  amount: number,                 // сумма (в USDC, учитывая decimals)
  description: string,
  category: "food" | "transport" | "accommodation" | "entertainment" | "other",
  date: Date,
  splits: [{
    userId: ObjectId,             // участник, на кого делится
    amount: number,               // его доля
    percentage?: number,          // процент (если custom split)
  }],
  receipt?: string,               // URL фото чека
  solanaExpensePDA?: string,      // адрес PDA расхода на Solana
  createdAt: Date,
  updatedAt: Date,
}

// ============ Settlements ============
{
  _id: ObjectId,
  groupId: ObjectId,
  fromUser: ObjectId,             // кто платит
  toUser: ObjectId,               // кто получает
  amount: number,                 // сумма USDC
  status: "pending" | "processing" | "completed" | "failed" | "disputed",
  solanaTransactionId?: string,   // хэш Solana транзакции
  solanaSettlementPDA?: string,   // адрес PDA расчёта
  completedAt?: Date,
  expiresAt: Date,                // если не оплачен за N дней
  notes?: string,
  createdAt: Date,
  updatedAt: Date,
}

// ============ Notifications ============
{
  _id: ObjectId,
  userId: ObjectId,
  type: "expense_added" | "settlement_reminder" | "payment_received" | 
        "member_joined" | "group_invite" | "dispute_opened",
  title: string,
  body: string,
  data: {                        // ссылки на связанные сущности
    groupId?: string,
    expenseId?: string,
    settlementId?: string,
  },
  read: boolean,
  createdAt: Date,
}
```

---

## 4. API Design (NestJS)

### 4.1 REST Endpoints

```
# Auth
POST   /api/v1/auth/register              # Регистрация (email)
POST   /api/v1/auth/login                 # Логин (email)
POST   /api/v1/auth/wallet/challenge      # Получить challenge для wallet auth
POST   /api/v1/auth/wallet/verify         # Верифицировать подпись wallet
POST   /api/v1/auth/google                # Google OAuth
POST   /api/v1/auth/refresh               # Обновить JWT
GET    /api/v1/auth/me                    # Текущий пользователь
PATCH  /api/v1/auth/me                    # Обновить профиль

# Users
GET    /api/v1/users/:id                  # Получить пользователя
GET    /api/v1/users/search?q=            # Поиск пользователей

# Groups
POST   /api/v1/groups                     # Создать группу
GET    /api/v1/groups                     # Список групп пользователя
GET    /api/v1/groups/:id                 # Детали группы
PATCH  /api/v1/groups/:id                 # Обновить группу
DELETE /api/v1/groups/:id                 # Удалить группу
POST   /api/v1/groups/:id/invite          # Сгенерировать invite code
POST   /api/v1/groups/:id/join            # Присоединиться по коду
POST   /api/v1/groups/:id/leave           # Покинуть группу
DELETE /api/v1/groups/:id/members/:userId # Удалить участника (admin)

# Expenses
POST   /api/v1/groups/:groupId/expenses         # Добавить расход
GET    /api/v1/groups/:groupId/expenses          # Список расходов
GET    /api/v1/groups/:groupId/expenses/:id      # Детали расхода
PATCH  /api/v1/groups/:groupId/expenses/:id      # Редактировать расход
DELETE /api/v1/groups/:groupId/expenses/:id      # Удалить расход

# Settlements (долги/расчёты)
GET    /api/v1/groups/:groupId/settlements/balance  # Кто кому сколько должен
GET    /api/v1/groups/:groupId/settlements          # История расчётов
POST   /api/v1/groups/:groupId/settlements          # Создать settlement (запрос платежа)
PATCH  /api/v1/settlements/:id                      # Обновить статус

# Solana-специфичные
POST   /api/v1/settlements/:id/prepare-tx     # Получить готовую транзакцию для подписи
POST   /api/v1/settlements/:id/confirm        # Подтвердить транзакцию (после подписи)
GET    /api/v1/settlements/:id/verify         # Проверить статус on-chain

# Notifications
GET    /api/v1/notifications                  # Получить уведомления
PATCH  /api/v1/notifications/:id/read         # Отметить прочитанным
```

### 4.2 WebSocket Events

```
# Client → Server
join:group:{groupId}          # Подписаться на обновления группы
leave:group:{groupId}         # Отписаться

# Server → Client
group:{groupId}:expense:new         # Добавлен новый расход
group:{groupId}:expense:updated     # Расход изменён
group:{groupId}:expense:deleted     # Расход удалён
group:{groupId}:settlement:new      # Новый запрос платежа
group:{groupId}:settlement:paid     # Платёж выполнен
group:{groupId}:member:joined       # Новый участник
group:{groupId}:member:left         # Участник вышел
```

---

## 5. Solana Integration

### 5.1 Anchor Program (On-chain)

Программа на Solana для хранения групп, расходов и расчётов.

**Accounts (PDA):**

```rust
// Группа расходов
#[account]
pub struct ExpenseGroup {
    pub authority: Pubkey,          // создатель группы
    pub name: String,               // до 32 символов
    pub member_count: u8,           // количество участников
    pub total_spent: u64,           // всего потрачено
    pub bump: u8,
}

// Расход
#[account]
pub struct Expense {
    pub group: Pubkey,              // ссылка на группу
    pub paid_by: Pubkey,            // кто оплатил
    pub amount: u64,                // сумма
    pub description: String,        // до 48 символов
    pub settlement_count: u8,       // количество погашенных долей
    pub settled: bool,              // все погашено?
    pub bump: u8,
}

// Расчёт (settlement)
#[account]
pub struct Settlement {
    pub from: Pubkey,               // кто платит
    pub to: Pubkey,                 // кто получает
    pub group: Pubkey,              // группа
    pub amount: u64,                // сумма
    pub status: SettlementStatus,   // Pending | Completed | Disputed
    pub bump: u8,
}
```

**Инструкции:**

```rust
// Управление группами
create_group(ctx, name: String)              // Создать группу
add_member(ctx)                              // Добавить участника
remove_member(ctx)                           // Удалить участника
close_group(ctx)                             // Закрыть группу

// Управление расходами
add_expense(ctx, amount: u64, description: String)  // Добавить расход
settle_expense(ctx, expense_bump: u8)               // Погасить долю

// Расчёты
create_settlement(ctx, amount: u64)          // Создать расчёт
complete_settlement(ctx)                     // Подтвердить расчёт (USDC переведён)
dispute_settlement(ctx)                      // Открыть диспут
resolve_settlement(ctx)                      // Разрешить диспут

// Вспомогательные
get_balance(ctx, group: Pubkey)              // Баланс группы on-chain
```

### 5.2 USDC Integration

| Деталь | Значение |
|--------|---------|
| **Token Mint** | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (mainnet) |
| **Decimals** | 6 |
| **Версия** | SPL Token (Token-2022) |
| **Трансфер** | CPI в Token Program через Associated Token Accounts |

**Flow платежа (клиент):**
1. NestJS создаёт Settlement в MongoDB + Solana PDA
2. Клиент получает `prepare-tx` с частично подписанной транзакцией
3. Пользователь подписывает транзакцию в Phantom/Solflare
4. Клиент отправляет подписанную транзакцию в сеть
5. Helius Webhook уведомляет NestJS о подтверждении
6. NestJS обновляет статус Settlement

### 5.3 Solana PDA Seeds

```rust
// Seeds для PDA
// Группа
seeds = [b"splitpay-group", authority.key().as_ref(), group_id.as_ref()]

// Расход
seeds = [b"splitpay-expense", group.key().as_ref(), expense_id.as_ref()]

// Расчёт
seeds = [b"splitpay-settlement", from.key().as_ref(), to.key().as_ref(), group.key().as_ref()]
```

---

## 6. Frontend (Vue.js + Framework7)

### 6.1 Структура страниц (Routes)

```
/login                        — Вход (wallet / email / Google)
/register                     — Регистрация

/groups                       — Список групп (главная страница)
/groups/new                   — Создать группу
/groups/:id                   — Детали группы (dashboard)
/groups/:id/expenses          — Список расходов группы
/groups/:id/expenses/new      — Добавить расход
/groups/:id/expenses/:eid     — Детали расхода
/groups/:id/balances          — Балансы (кто кому должен)
/groups/:id/settle            — Оплатить долг
/groups/:id/settings          — Настройки группы
/groups/:id/members           — Участники

/profile                      — Профиль / настройки
/profile/wallet               — Подключение кошелька
/profile/notifications        — Уведомления

/activity                     — Лента активности (по всем группам)
```

### 6.2 Pinia Stores

```typescript
stores/
├── auth.ts          // auth state, JWT, wallet connection
├── groups.ts        // groups CRUD, members
├── expenses.ts      // expenses for active group
├── settlements.ts   // balances, payments
├── notifications.ts // push notifications
└── wallet.ts        // Solana wallet connection
```

### 6.3 Service Layer

```typescript
services/
├── api.ts                    // Axios instance с JWT interceptor
├── solana.ts                 // @solana/kit — RPC, транзакции
├── wallet-adapter.ts         // Wallet Standard integration
├── websocket.ts              // Socket.io client
└── utils/
    ├── split-calculator.ts   // Алгоритм расчёта долгов
    └── format.ts             // Форматирование чисел/USDC
```

### 6.4 Framework7 тема

- **iOS theme** для iPhone пользователей
- **Material theme** для Android
- Tailwind CSS для тонкой настройки и кастомных компонентов
- PWA Service Worker для оффлайн-доступа к данным

---

## 7. Settlement Engine (Алгоритм расчёта долгов)

### 7.1 Core Algorithm

Вход: список расходов с участниками и долями.
Выход: минимальный набор платежей (кто → кому → сколько).

```typescript
function calculateSettlements(expenses: Expense[]): Settlement[] {
  // 1. Считаем баланс каждого участника
  //    positive = ему должны, negative = он должен
  const balances: Map<string, number> = {}
  
  for (const expense of expenses) {
    balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount
    for (const split of expense.splits) {
      balances[split.userId] = (balances[split.userId] || 0) - split.amount
    }
  }

  // 2. Минимизация транзакций (greedy algorithm)
  const debtors = sort(Object.entries(balances).filter(([_, v]) => v < 0), by balance asc)
  const creditors = sort(Object.entries(balances).filter(([_, v]) => v > 0), by balance desc)
  
  const settlements: Settlement[] = []
  
  while (debtors.length > 0 && creditors.length > 0) {
    const [debtorId, debtAmount] = debtors[0]
    const [creditorId, creditAmount] = creditors[0]
    
    const amount = min(Math.abs(debtAmount), creditAmount)
    
    settlements.push({
      fromUser: debtorId,
      toUser: creditorId,
      amount,
    })
    
    // Обновляем остатки
    debtors[0][1] += amount
    creditors[0][1] -= amount
    
    if (debtors[0][1] >= 0) debtors.shift()
    if (creditors[0][1] <= 0) creditors.shift()
  }
  
  return settlements
}
```

---

## 8. Безопасность

### 8.1 Аутентификация
- JWT access + refresh tokens
- Wallet auth: challenge → sign → verify (EIP-712-like для Solana)
- Rate limiting на auth endpoints (NestJS)
- bcrypt для паролей

### 8.2 Транзакции
- Верификация подписанных транзакций на бэкенде
- Проверка recipient address перед отправкой
- Лимиты на сумму платежа (настраиваемые)
- Подтверждение через Helius webhook (вторичная проверка)

### 8.3 Данные
- Шифрование чувствительных полей в MongoDB
- HTTPS everywhere
- CORS — только origin PWA
- XSS защита через Content Security Policy

---

## 9. MVP Milestones (Итерации)

### Milestone 1: Базовый backend + auth (2-3 часа)
- [x] NestJS проект + MongoDB connection
- [x] User model + auth (wallet + email)
- [x] JWT guard + middleware
- [ ] Базовые CRUD: Groups, Expenses
- [ ] Settlement engine (алгоритм расчёта)

### Milestone 2: Solana программа (3-4 часа)
- [ ] Anchor проект с ExpenseGroup, Expense, Settlement
- [ ] Инструкции: create_group, add_expense, settle
- [ ] Unit тесты (LiteSVM)
- [ ] USDC CPI для трансферов
- [ ] Deploy на devnet

### Milestone 3: Frontend MVP (3-4 часа)
- [ ] Vue.js + Framework7 проект
- [ ] Wallet connect (Phantom/Solflare)
- [ ] Auth flow (login/register)
- [ ] Groups UI (список, создание)
- [ ] Expenses UI (добавить, список)

### Milestone 4: Платежи + webhooks (2-3 часа)
- [ ] Settlement UI (кто кому должен)
- [ ] USDC payment flow (prepare → sign → send → confirm)
- [ ] Helius webhook интеграция
- [ ] Real-time обновления (Socket.io)
- [ ] Уведомления

### Milestone 5: Polish + devnet deploy (2-3 часа)
- [ ] Framework7 темизация (iOS + Android)
- [ ] PWA service worker + оффлайн
- [ ] Push-уведомления
- [ ] Приглашения по коду
- [ ] Deploy на devnet (программа + бэкенд)
- [ ] Интеграционные тесты

---

## 10. Директории проекта

```
splitpay/
├── frontend/                          # Vue.js + Framework7 PWA
│   ├── src/
│   │   ├── assets/
│   │   ├── components/                # Vue компоненты
│   │   │   ├── layout/                # Header, Footer, Navigation
│   │   │   ├── groups/                # Group components
│   │   │   ├── expenses/              # Expense components
│   │   │   ├── settlement/            # Settlement components
│   │   │   └── common/                # Shared components
│   │   ├── pages/                     # Страницы-роуты
│   │   ├── stores/                    # Pinia stores
│   │   ├── services/                  # API, Solana, WS
│   │   ├── composables/               # Vue composables
│   │   ├── router/                    # Vue Router
│   │   └── types/                     # TypeScript типы
│   ├── framework7/                    # F7 спецфайлы (manifest, service worker)
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                           # NestJS API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── groups/
│   │   │   ├── expenses/
│   │   │   ├── settlements/
│   │   │   ├── notifications/
│   │   │   └── solana/                # Helius webhooks, tx watcher
│   │   ├── common/                    # Guards, decorators, filters
│   │   ├── config/                    # Environment config
│   │   ├── database/                  # Mongoose schemas
│   │   └── main.ts
│   ├── test/
│   ├── package.json
│   └── nest-cli.json
│
├── program/                           # Anchor Solana program
│   ├── programs/
│   │   └── splitpay/
│   │       ├── src/
│   │       │   ├── lib.rs
│   │       │   ├── instructions/
│   │       │   └── state/
│   │       └── Cargo.toml
│   ├── tests/
│   ├── migrations/
│   ├── Anchor.toml
│   └── package.json
│
├── docs/                              # Документация
│   ├── SPLITPAY_TECH_SPEC.md
│   └── api-schema.md
│
├── .superstack/
│   └── build-context.md
│
├── .env.example
├── .gitignore
└── README.md
```

---

## 11. Окружение и инфраструктура

### 11.1 Development

```bash
# Solana (devnet)
SOLANA_RPC_URL=https://api.devnet.solana.com

# MongoDB
MONGODB_URI=mongodb://localhost:27017/splitpay

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=dev-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Helius
HELIUS_API_KEY=your-helius-key
HELIUS_WEBHOOK_URL=https://your-ngrok/wh/solana

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Frontend
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=http://localhost:3000
VITE_SOLANA_RPC=https://api.devnet.solana.com
```

### 11.2 Production

- Backend: Railway / Render / DigitalOcean App Platform
- MongoDB: MongoDB Atlas
- Redis: Upstash / Redis Cloud
- Frontend: Vercel / Netlify / Cloudflare Pages
- Solana RPC: Helius (paid plan для reliability)

---

## 12. Риски и митигация

| Риск | Вероятность | Митигация |
|------|------------|-----------|
| Высокие комиссии Solana при нагрузке | Низкая | Priority fees auto-adjustment |
| Пользователь отправил USDC не туда | Средняя | Preview транзакции + подтверждение UI |
| Диспуты (кто сколько платил) | Средняя | On-chain запись + спорный escrow |
| User onboarding сложный (wallet) | Средняя | Email/Google auth как fallback |
| PWA оффлайн-режим ограничен | Низкая | Кэширование последних данных |
| Solana транзакция зависла | Низкая | Retry logic + fallback через бэкенд |

---

## 13. Следующие шаги

1. ✅ Согласовать эту спецификацию
2. 🔜 Установить dev-окружение (см. раздел 11)
3. 🔜 Milestone 1: Backend + Auth
4. 🔜 Milestone 2: Solana Program
5. 🔜 Milestone 3: Frontend
6. 🔜 Milestone 4: Payments + Webhooks
7. 🔜 Milestone 5: Polish + Devnet Deploy
