import { chatService } from './chatService'
import { session } from '@/stores/authStore'

const reportedErrors = new Set()
const MAX_REPORTED_ERRORS = 50
let installed = false

function errorDetails(error) {
  if (error instanceof Error) return error.stack || error.message
  return typeof error === 'string' ? error : String(error)
}

function reportClientError(error, context) {
  if (!session.token) return

  const details = errorDetails(error)
  const route = window.location.pathname
  const fingerprint = `${route}\n${details}`
  if (reportedErrors.has(fingerprint)) return

  if (reportedErrors.size >= MAX_REPORTED_ERRORS) {
    reportedErrors.delete(reportedErrors.values().next().value)
  }
  reportedErrors.add(fingerprint)

  const description = [
    `Error del frontend: ${context}`,
    `Ruta: ${route}`,
    `Fecha: ${new Date().toISOString()}`,
    `Stack trace: ${details}`
  ]
    .join('\n')
    .slice(0, 1500)

  chatService.reportClientError(description).catch((failure) => {
    console.warn('No se pudo enviar el reporte de error del frontend.', failure)
  })
}

export function installClientErrorReporting() {
  if (installed) return
  installed = true

  window.addEventListener('error', (event) => {
    if (!event.error && !event.message) return
    reportClientError(event.error || event.message, 'window.error')
  })

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, 'unhandledrejection')
  })
}

export function reportVueError(error, info) {
  console.error(`Error no controlado en Vue (${info}).`, error)
  reportClientError(error, `Vue: ${info}`)
}
