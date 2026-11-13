import { get } from './httpClient'

export const ticketService = {
  getMyTickets() {
    return get('/my/tickets')
  }
}