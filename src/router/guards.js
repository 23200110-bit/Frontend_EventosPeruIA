import { session } from '@/stores/authStore'

export function authGuard(to) {
  if (to.meta.auth && !session.token) {
    return { path: '/login', query: { next: to.fullPath } }
  }
  return true
}