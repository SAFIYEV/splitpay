import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'SplitPay — Split expenses, settle in USDC',
        short_name: 'SplitPay',
        description: 'Split group expenses and settle debts instantly in USDC on Solana.',
        theme_color: '#7c3aed',
        background_color: '#0f0a1e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      // API responses are deliberately NOT cached by the service worker:
      // authorized payloads contain PII/balances, the cache key cannot
      // distinguish users, and stale financial data is worse than no data.
      // Only static assets are precached.
      workbox: {},
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
