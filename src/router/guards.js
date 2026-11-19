import { session } from '@/stores/authStore'

export function authGuard(to) {
  if (to.meta.auth && !session.token) {
    return { path: '/login', query: { next: to.fullPath } }
  }
  if (to.meta.admin && !session.user?.isAdministrator) {
    return { path: '/' }
  }
  // El administrador solo modera: no usa pantallas de asistente ni de organizador
  if (to.meta.noAdmin && session.user?.isAdministrator) return { path: '/admin' }
  return true
}