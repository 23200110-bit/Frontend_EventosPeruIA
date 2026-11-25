import { api, get, post, put } from './httpClient'

export const eventService = {
  getCategories() {
    return get('/catalog/categories')
  },
  searchEvents({ page = 1, pageSize = 12, filter = {} } = {}) {
    const params = new URLSearchParams({ page, pageSize })
    for (const [key, value] of Object.entries(filter)) {
      if (value !== null && value !== '') {
        params.set(
          key,
          key === 'from' || key === 'to'
            ? `${value}T${key === 'to' ? '23:59:59' : '00:00:00'}-05:00`
            : value
        )
      }
    }
    return get(`/catalog/events?${params}`)
  },
  getEventById(id) {
    return get(`/catalog/events/${id}`)
  },
  getEventReviews(id) {
    return get(`/events/${id}/reviews`)
  },
  createReview(id, payload) {
    return post(`/events/${id}/reviews`, payload)
  },
  getRecommendations(limit = 20) {
    return get(`/recommendations?limit=${limit}`)
  },
  getMyEvents() {
    return get('/eventos/mis-eventos')
  },
  getMyEventDetail(id) {
    return get(`/eventos/mis-eventos/${id}`)
  },
  // Sugiere un borrador a partir de un flyer; no guarda nada.
  draftFromFlyer(payload) {
    return post('/eventos/flyer-borrador', payload, { timeoutMs: 90000 })
  },
  createEvent(payload) {
    return post('/eventos', payload)
  },
  updateEvent(id, payload) {
    return put(`/eventos/${id}`, { ...payload, eventoId: Number(id) })
  },
  cancelEvent(id, payload) {
    return api(`/eventos/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  },
  // US-019: asistentes de un evento propio
  getEventAttendees(id, { buscar = '', estado = '', pagina = 1, tamanoPagina = 20 } = {}) {
    const params = new URLSearchParams({ pagina, tamanoPagina })
    if (buscar) params.set('buscar', buscar)
    if (estado) params.set('estado', estado)
    return get(`/events/${id}/asistentes?${params}`)
  },
  // US-016: moderación administrativa
  adminGetUsers({ buscar = '', estado = '', pagina = 1, tamanoPagina = 10 } = {}) {
    const params = new URLSearchParams({ pagina, tamanoPagina })
    if (buscar) params.set('buscar', buscar)
    if (estado) params.set('estado', estado)
    return get(`/admin/usuarios?${params}`)
  },
  adminToggleUser(id, { estado, motivo }) {
    return api(`/admin/usuarios/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado, motivo, confirmado: true })
    })
  },
  adminGetEvents({ buscar = '', estado = '', pagina = 1, tamanoPagina = 10 } = {}) {
    const params = new URLSearchParams({ pagina, tamanoPagina })
    if (buscar) params.set('buscar', buscar)
    if (estado) params.set('estado', estado)
    return get(`/admin/eventos?${params}`)
  },
  adminModerateEvent(id, { accion, motivo }) {
    return api(`/admin/eventos/${id}/moderar`, {
      method: 'PATCH',
      body: JSON.stringify({ accion, motivo, confirmado: true })
    })
  }
}