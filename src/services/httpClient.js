import { session, signOut } from '@/stores/authStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function api(path, { timeoutMs = 15000, responseType = 'json', ...options } = {}) {
  const requestToken = session.token
  const requestUser = session.user
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(BASE_URL + path, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(requestToken ? { Authorization: 'Bearer ' + requestToken } : {}),
        ...options.headers
      }
    })

    if (response.ok && responseType === 'blob') {
      return await response.blob()
    }

    const data = response.status === 204 ? null : await response.json().catch(() => null)

    if (!response.ok) {
      if (
        response.status === 401 &&
        requestToken &&
        session.token === requestToken &&
        session.user === requestUser
      ) {
        signOut()
      }

      const validation = data?.errors ? Object.values(data.errors).flat().join(' ') : ''
      const error = new Error(
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
      error.status = response.status
      throw error
    }

    return data
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('La API tardó demasiado. Intenta nuevamente.')
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
