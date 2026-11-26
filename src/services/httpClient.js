import { session, signOut } from '@/stores/authStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function api(path, { timeoutMs = 15000, ...options } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let reached = false

  try {
    const response = await fetch(BASE_URL + path, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(session.token ? { Authorization: 'Bearer ' + session.token } : {}),
        ...options.headers
      }
    })

    reached = true
    const data = response.status === 204 ? null : await response.json().catch(() => null)

    if (!response.ok) {
      if (response.status === 401 && session.token) signOut()
      const validation = data?.errors ? Object.values(data.errors).flat().join(' ') : ''
      throw new Error(
        data?.message ||
          data?.mensaje ||
          validation ||
          (response.status === 401
            ? 'Inicia sesión para continuar.'
            : response.status === 404
              ? 'No se encontró el recurso.'
              : response.status === 429
                ? 'Hay demasiadas solicitudes. Intenta nuevamente en un momento.'
                : 'No se pudo completar la operación.')
      )
    }

    return data
  } catch (error) {
    if (error.name === 'AbortError') {
      const late = new Error('No pudimos conectar a tiempo. Verifica tu conexión e inténtalo otra vez.')
      late.kind = 'timeout'
      throw late
    }
    if (error instanceof TypeError && !reached) {
      const offline = new Error('No pudimos conectar con el servidor. Verifica tu conexión e inténtalo otra vez.')
      offline.kind = 'network'
      throw offline
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export function get(path, options = {}) {
  return api(path, { ...options, method: 'GET' })
}

export function post(path, body, options = {}) {
  return api(path, { ...options, method: 'POST', body: JSON.stringify(body) })
}

export function put(path, body, options = {}) {
  return api(path, { ...options, method: 'PUT', body: JSON.stringify(body) })
}

export function del(path, options = {}) {
  return api(path, { ...options, method: 'DELETE' })
}