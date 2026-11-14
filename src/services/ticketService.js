import { get, post } from './httpClient'

export const ticketService = {
  getMyTickets() {
    return get('/my/tickets')
  },

  //HU-12: check-in SANTIAGO
  validateQr(payload) {
    return post('/tickets/validate-qr', payload)
  }
}