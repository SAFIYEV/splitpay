import type { Router } from 'framework7/types'
import { useAuthStore } from '@/stores/auth'

// Framework7 routes (spec 6.1). framework7-vue uses its own router — it
// drives F7 page transitions, so vue-router is intentionally not used.

function requireAuth({ resolve }: Router.RouteCallbackCtx) {
  const auth = useAuthStore()
  if (auth.isAuthenticated) resolve()
  else resolve({}, { redirect: '/login/' })
}

function requireGuest({ resolve }: Router.RouteCallbackCtx) {
  const auth = useAuthStore()
  if (auth.isAuthenticated) resolve({}, { redirect: '/groups/' })
  else resolve()
}

const routes: Router.RouteParameters[] = [
  {
    path: '/',
    redirect: '/groups/',
  },
  {
    path: '/login/',
    component: () => import('@/pages/auth/LoginPage.vue'),
    beforeEnter: requireGuest,
  },
  {
    path: '/register/',
    component: () => import('@/pages/auth/RegisterPage.vue'),
    beforeEnter: requireGuest,
  },
  {
    path: '/groups/',
    component: () => import('@/pages/groups/GroupsPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/new/',
    component: () => import('@/pages/groups/GroupNewPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/',
    component: () => import('@/pages/groups/GroupDashboardPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/expenses/',
    component: () => import('@/pages/expenses/ExpensesPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/expenses/new/',
    component: () => import('@/pages/expenses/ExpenseNewPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/expenses/:eid/',
    component: () => import('@/pages/expenses/ExpenseDetailPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/balances/',
    component: () => import('@/pages/settlement/BalancesPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/settle/',
    component: () => import('@/pages/settlement/SettlePage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/settings/',
    component: () => import('@/pages/groups/GroupSettingsPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/members/',
    component: () => import('@/pages/groups/GroupMembersPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/profile/',
    component: () => import('@/pages/profile/ProfilePage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/profile/wallet/',
    component: () => import('@/pages/profile/WalletPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/profile/notifications/',
    component: () => import('@/pages/profile/NotificationsPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/activity/',
    component: () => import('@/pages/ActivityPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '(.*)',
    component: () => import('@/pages/NotFoundPage.vue'),
  },
]

export default routes
