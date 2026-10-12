import type { Router } from 'framework7/types'
import { useAuthStore } from '@/stores/auth'

// Framework7 routes (spec 6.1). framework7-vue uses its own router — it
// drives F7 page transitions, so vue-router is intentionally not used.
// NOTE: dynamic imports MUST use `asyncComponent` — a function passed as
// `component` is treated as an F7 template function and its Promise return
// value gets stringified into the DOM ("[object Promise]").

// NOTE: F7's process-route-queue calls beforeEnter's resolve() with no
// arguments — `resolve({}, { redirect })` silently drops the redirect.
// The supported pattern is reject() + an explicit router.navigate().
function requireAuth({ resolve, reject, router }: Router.RouteCallbackCtx) {
  const auth = useAuthStore()
  if (auth.isAuthenticated) {
    resolve()
  } else {
    reject()
    router.navigate('/login/')
  }
}

function requireGuest({ resolve, reject, router }: Router.RouteCallbackCtx) {
  const auth = useAuthStore()
  if (auth.isAuthenticated) {
    reject()
    router.navigate('/groups/')
  } else {
    resolve()
  }
}

const routes: Router.RouteParameters[] = [
  {
    path: '/',
    // Function redirect picks the landing page without ever loading the wrong
    // page first (a static redirect to /groups/ would mount GroupsPage and
    // leave it as a dead page under the login page after the guard bounces).
    redirect() {
      const auth = useAuthStore()
      return auth.isAuthenticated ? '/groups/' : '/login/'
    },
  },
  {
    path: '/login/',
    asyncComponent: () => import('@/pages/auth/LoginPage.vue'),
    beforeEnter: requireGuest,
  },
  {
    path: '/register/',
    asyncComponent: () => import('@/pages/auth/RegisterPage.vue'),
    beforeEnter: requireGuest,
  },
  {
    path: '/groups/',
    asyncComponent: () => import('@/pages/groups/GroupsPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/new/',
    asyncComponent: () => import('@/pages/groups/GroupNewPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/',
    asyncComponent: () => import('@/pages/groups/GroupDashboardPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/expenses/',
    asyncComponent: () => import('@/pages/expenses/ExpensesPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/expenses/new/',
    asyncComponent: () => import('@/pages/expenses/ExpenseNewPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/expenses/:eid/',
    asyncComponent: () => import('@/pages/expenses/ExpenseDetailPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/balances/',
    asyncComponent: () => import('@/pages/settlement/BalancesPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/settle/',
    asyncComponent: () => import('@/pages/settlement/SettlePage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/settings/',
    asyncComponent: () => import('@/pages/groups/GroupSettingsPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/groups/:id/members/',
    asyncComponent: () => import('@/pages/groups/GroupMembersPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/profile/',
    asyncComponent: () => import('@/pages/profile/ProfilePage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/profile/wallet/',
    asyncComponent: () => import('@/pages/profile/WalletPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/profile/notifications/',
    asyncComponent: () => import('@/pages/profile/NotificationsPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '/profile/security/',
    asyncComponent: () => import('@/pages/profile/StubPage.vue'),
    beforeEnter: requireAuth,
    options: {
      props: {
        title: 'Безопасность',
        text: 'Двухфакторная защита и управление сессиями скоро появятся.',
        icon: 'shield_check',
      },
    },
  },
  {
    path: '/profile/help/',
    asyncComponent: () => import('@/pages/profile/StubPage.vue'),
    beforeEnter: requireAuth,
    options: {
      props: {
        title: 'Помощь и поддержка',
        text: 'Частые вопросы и чат поддержки скоро появятся.',
        icon: 'questionmark_circle',
      },
    },
  },
  {
    path: '/profile/about/',
    asyncComponent: () => import('@/pages/profile/StubPage.vue'),
    beforeEnter: requireAuth,
    options: {
      props: {
        title: 'О приложении',
        text: 'SplitPay · расчёты в USDC на Solana · версия 0.1 (devnet)',
        icon: 'info_circle',
      },
    },
  },
  {
    path: '/activity/',
    asyncComponent: () => import('@/pages/ActivityPage.vue'),
    beforeEnter: requireAuth,
  },
  {
    path: '(.*)',
    asyncComponent: () => import('@/pages/NotFoundPage.vue'),
  },
]

export default routes
