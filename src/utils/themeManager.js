import { ref } from 'vue'
import { Dark } from 'quasar'

export const THEME_OPTIONS = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark'
}

const STORAGE_KEY = 'app-theme-preference'
const VALID = [THEME_OPTIONS.SYSTEM, THEME_OPTIONS.LIGHT, THEME_OPTIONS.DARK]

export function getStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return VALID.includes(value) ? value : THEME_OPTIONS.SYSTEM
  } catch {
    return THEME_OPTIONS.SYSTEM
  }
}

// Elección actual, reactiva para el selector del encabezado
export const themeChoice = ref(getStoredTheme())

// Valor para la opción "dark" de Quasar: 'auto' sigue al sistema
export function quasarDarkSetting(theme = themeChoice.value) {
  if (theme === THEME_OPTIONS.DARK) return true
  if (theme === THEME_OPTIONS.LIGHT) return false
  return 'auto'
}

function applyAttribute(theme) {
  const root = document.documentElement
  if (theme === THEME_OPTIONS.SYSTEM) root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

// Aplica la elección a las variables CSS y a los componentes de Quasar
export function applyTheme(theme) {
  applyAttribute(theme)
  Dark.set(quasarDarkSetting(theme))
}

export function setTheme(theme) {
  if (!VALID.includes(theme)) return
  themeChoice.value = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Sin almacenamiento disponible: la elección vale sólo en esta pestaña
  }
  applyTheme(theme)
}

// Antes de montar: sólo el atributo, para que las variables CSS no parpadeen.
// Quasar toma su modo de la opción config.dark en main.js.
export function initializeTheme() {
  applyAttribute(themeChoice.value)
}
