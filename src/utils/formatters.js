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