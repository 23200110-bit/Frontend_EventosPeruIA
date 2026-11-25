import { createApp } from 'vue'
import { Quasar } from 'quasar'
import es from 'quasar/lang/es'
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/dist/quasar.css'
import '@/assets/styles/style.css'
import '@/assets/styles/experience.css'
import '@/assets/styles/theme-blue.css'
import App from './App.vue'
import router from './router'
import { installClientErrorReporting, reportVueError } from '@/services/clientErrorReporter'

const app = createApp(App)

app.config.errorHandler = reportVueError

installClientErrorReporting()

app
  .use(Quasar, {
    lang: es,
    config: {
      brand: {
        primary: '#5038B9',
        secondary: '#DAA540',
        accent: '#F0EAFE'
      }
    }
  })
  .use(router)
  .mount('#app')