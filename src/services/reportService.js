import { get } from './httpClient'
import { session } from '@/stores/authStore'

async function downloadReport(format, extension, reporteId) {
  const requestToken = session.token
  const requestUser = session.user
  const query = new URLSearchParams({ reporteId })
  const blob = await get(`/reportes/exportar/${format}?${query}`, { responseType: 'blob' })

  if (session.token !== requestToken || session.user !== requestUser) return

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Reporte_Ventas.${extension}`
  document.body.append(link)

  try {
    link.click()
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export const reportService = {
  getDashboard({ eventoId, fechaInicio, fechaFin } = {}) {
    const query = new URLSearchParams()
    if (eventoId) query.set('eventoId', eventoId)
    if (fechaInicio) query.set('fechaInicio', fechaInicio)
    if (fechaFin) query.set('fechaFin', fechaFin)

    const suffix = query.size ? `?${query}` : ''
    return get(`/reportes/dashboard-organizador${suffix}`)
  },

  downloadExcel(reporteId) {
    return downloadReport('excel', 'xlsx', reporteId)
  },

  downloadPdf(reporteId) {
    return downloadReport('pdf', 'pdf', reporteId)
  }
}
