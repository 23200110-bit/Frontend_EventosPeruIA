export function money(value, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency
  }).format(value || 0)
}

export function date(value) {
  return value
    ? new Intl.DateTimeFormat('es-PE', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Lima'
      }).format(new Date(value))
    : 'Por confirmar'
}

const LIMA = 'America/Lima'

function parts(value, options) {
  const out = {}
  for (const p of new Intl.DateTimeFormat('es-PE', { timeZone: LIMA, ...options }).formatToParts(new Date(value))) {
    out[p.type] = p.value
  }
  return out
}

function clean(text) {
  return String(text || '').replace('.', '').toLowerCase()
}

// Formato corto para tarjetas: "sáb 14 dic · 21:00"
export function shortDate(value) {
  if (!value) return 'Por confirmar'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Por confirmar'
  const p = parts(value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })
  return clean(p.weekday) + ' ' + p.day + ' ' + clean(p.month) + ' · ' + p.hour + ':' + p.minute
}

// Clave de día en hora de Lima: "2026-12-14"
export function limaDayKey(value) {
  const p = parts(value, { year: 'numeric', month: '2-digit', day: '2-digit' })
  return p.year + '-' + p.month + '-' + p.day
}

// Encabezado de grupo por día: "Hoy", "Mañana" o "Sábado, 14 de diciembre"
export function dayHeading(value) {
  if (!value) return 'Fecha por confirmar'
  const key = limaDayKey(value)
  const now = new Date()
  if (key === limaDayKey(now)) return 'Hoy'
  if (key === limaDayKey(new Date(now.getTime() + 86400000))) return 'Mañana'
  const text = new Intl.DateTimeFormat('es-PE', {
    timeZone: LIMA,
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date(value))
  return text.charAt(0).toUpperCase() + text.slice(1)
}
