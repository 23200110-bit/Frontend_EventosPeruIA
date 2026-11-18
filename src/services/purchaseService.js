import { post } from './httpClient'

export const purchaseService = {
  // US-010: el servidor valida de nuevo el aforo y usa requestId para no cobrar dos veces un reintento.
  buy({ eventId, quantity, requestId }) {
    return post('/purchases', { eventoId: Number(eventId), cantidad: quantity, requestId })
  }
}
