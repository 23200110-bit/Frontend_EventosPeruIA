import { reactive } from 'vue'
import { resetChat } from './chatStore'

// Memoria de la pestaña: no se guardan tokens ni contraseñas en localStorage.
export const session = reactive({
  token: '',
  user: null
})

export function signIn(result) {
  if (!result?.accessToken || !result?.user) {
    throw new Error('La API no devolvió una sesión válida.')
  }
  session.token = result.accessToken
  session.user = result.user
  resetChat()
}

export function signOut() {
  session.token = ''
  session.user = null
  resetChat()
}