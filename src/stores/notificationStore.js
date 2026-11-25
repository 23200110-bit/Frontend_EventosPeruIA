import { reactive } from 'vue'
import { userService } from '@/services/userService'

// Cantidad de avisos sin leer, para el puntito rojo del menú.
export const notificationState = reactive({ unread: 0 })

export async function refreshUnread() {
  try {
    const items = await userService.getNotifications()
    notificationState.unread = Array.isArray(items) ? items.filter((n) => !n.read).length : 0
  } catch {
    // Es solo un indicador: si falla no se muestra error.
  }
}

export function setUnreadFromList(items) {
  notificationState.unread = Array.isArray(items) ? items.filter((n) => !n.read).length : 0
}

export function clearUnread() {
  notificationState.unread = 0
}
