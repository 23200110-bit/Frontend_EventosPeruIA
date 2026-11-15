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
  }
}