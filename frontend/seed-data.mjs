// Seed demo data for UI verification (dev only). Run: node seed-data.mjs
// Idempotent: wipes the user's groups first, then recreates the demo set.
const API = 'http://localhost:3000/api/v1'
const H = (t) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` })
const login = (email) =>
  fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'password123' }) }).then((r) => r.json())

const me = await login('reloadtest@test.dev')
console.log('me:', me.user.id)

// wipe existing groups so reseeding is idempotent
for (const g of await fetch(`${API}/groups`, { headers: H(me.accessToken) }).then((r) => r.json())) {
  const r = await fetch(`${API}/groups/${g.id}`, { method: 'DELETE', headers: H(me.accessToken) })
  console.log('delete group', g.name, r.status)
}

const group = await fetch(`${API}/groups`, {
  method: 'POST',
  headers: H(me.accessToken),
  body: JSON.stringify({ name: 'Trip to Bali 🌴', description: 'Бали рабочая поездка' }),
}).then((r) => r.json())
console.log('group:', group.id, group.name, 'invite:', group.inviteCode)

// Anna joins
await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'anna@test.dev', password: 'password123', displayName: 'Anna' }),
}).then((r) => console.log('anna register:', r.status)) // 409 = already exists
const anna = await login('anna@test.dev')
console.log('anna:', anna.user.id)

const join = await fetch(`${API}/groups/${group.id}/join`, {
  method: 'POST',
  headers: H(anna.accessToken),
  body: JSON.stringify({ inviteCode: group.inviteCode }),
})
console.log('anna join:', join.status)

const both = [me.user.id, anna.user.id]
const eq = (amount) => both.map((userId) => ({ userId, amount: Math.round((amount / 2) * 1e6) / 1e6 }))

async function addExpense(token, amount, description, category, daysAgo = 0) {
  const d = new Date(Date.now() - daysAgo * 86400000).toISOString()
  const r = await fetch(`${API}/groups/${group.id}/expenses`, {
    method: 'POST',
    headers: H(token),
    body: JSON.stringify({ amount, description, category, date: d, splits: eq(amount) }),
  })
  console.log('expense', description, r.status)
}

// I pay the villa (I become creditor), Anna pays dinner+taxi (she owes me).
await addExpense(me.accessToken, 800.0, 'Аренда виллы', 'accommodation', 2)
await addExpense(anna.accessToken, 152.45, 'Ужин в ресторане', 'food', 1)
await addExpense(anna.accessToken, 45.0, 'Такси из аэропорта', 'transport')

const bal = await fetch(`${API}/groups/${group.id}/settlements/balance`, { headers: H(me.accessToken) }).then((r) => r.json())
console.log('balance:', JSON.stringify(bal))
