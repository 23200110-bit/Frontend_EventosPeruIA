import { reactive } from 'vue'
import { resetChat } from './chatStore'

const STORAGE_KEY = 'eventosperu_session'

function loadInitialSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { token: '', user: null }
    const parsed = JSON.parse(raw)
    return {
      token: parsed?.token || '',
      user: parsed?.user || null
    }
  } catch {
    return { token: '', user: null }
  }
}

const initial = loadInitialSession()

export const session = reactive({
  token: initial.token,
  user: initial.user
})

export function signIn(result) {
  if (!result?.accessToken || !result?.user) {
    throw new Error('La API no devolvió una sesión válida.')
  }
  session.token = result.accessToken
  session.user = result.user
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ token: result.accessToken, user: result.user })
  )
  resetChat()
}

export function signOut() {
  session.token = ''
  session.user = null
  sessionStorage.removeItem(STORAGE_KEY)
  resetChat()
}