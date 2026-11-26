import { createApp } from 'vue'
import { Quasar } from 'quasar'
import es from 'quasar/lang/es'
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/dist/quasar.css'
import '@/assets/styles/style.css'
import '@/assets/styles/experience.css'
import '@/assets/styles/theme-blue.css'
import '@/assets/styles/ui-system.css'
import App from './App.vue'
import router from './router'
import { installClientErrorReporting, reportVueError } from '@/services/clientErrorReporter'
import { initializeTheme, quasarDarkSetting } from '@/utils/themeManager'

// Tema antes de montar: evita el destello claro al abrir en modo oscuro
initializeTheme()

const app = createApp(App)

app.config.errorHandler = reportVueError

installClientErrorReporting()

app
  .use(Quasar, {
    lang: es,
    config: {
      dark: quasarDarkSetting(),
      brand: {
        primary: '#5038B9',
        secondary: '#DAA540',
        accent: '#F0EAFE'
      }
    }
  })
  .use(router)
  .mount('#app')
