import { get, post, put } from './httpClient'

export const userService = {
  getProfile() {
    return get('/profile')
  },
  updateProfile(payload) {
    return put('/profile', payload)
  },
  getNotifications() {
    return get('/my/notifications')
  },
  markNotificationRead(id) {
    return post(`/my/notifications/${id}/read`, {})
  }
}