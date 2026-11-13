import { post } from './httpClient'

export const authService = {
  login(credentials) {
    return post('/auth/login', credentials)
  },
  register(payload) {
    return post('/auth/register', payload)
  }
}