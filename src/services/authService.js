import { post } from './httpClient'

export const authService = {
  login(credentials) {
    return post('/auth/login', credentials)
  },
  register(payload) {
    return post('/auth/register', payload)
  },
  // US-018: recuperación de contraseña
  forgotPassword(email) {
    return post('/auth/forgot-password', { email })
  },
  resetPassword({ token, password, confirmPassword }) {
    return post('/auth/reset-password', { token, password, confirmPassword })
  }
}
