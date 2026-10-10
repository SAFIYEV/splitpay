import { createApp, type App as VueApp } from 'vue'
import { createPinia } from 'pinia'
import Framework7 from 'framework7/lite-bundle'
import Framework7Vue, * as f7vueBundle from 'framework7-vue/bundle'

import 'framework7/css/bundle'
import 'framework7-icons/css/framework7-icons.css'
import './style.css'

import App from './App.vue'

// registerComponents exists at runtime but is missing from framework7-vue's
// shipped type declarations — narrow it locally.
const { registerComponents } = f7vueBundle as unknown as {
  registerComponents: (app: VueApp) => void
}

Framework7.use(Framework7Vue)

const app = createApp(App)
app.use(createPinia())
registerComponents(app)
app.mount('#app')
