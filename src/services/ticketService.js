import { get, post } from './httpClient'

export const ticketService = {
  getMyTickets() {
    return get('/entradas/mis-entradas')
  },

  getVoucher(entradaId) {
    return get(`/entradas/${entradaId}/voucher`)
  },

  // HU-12: check-in SANTIAGO
  validateQr(payload) {
    return post('/tickets/validate-qr', payload)
  }
}