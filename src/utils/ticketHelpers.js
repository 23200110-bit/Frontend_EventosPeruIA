const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeTicketStatus(status) {
  const s = (status || '').toLowerCase().trim()
  if (s === 'válida' || s === 'valida') return 'valida'
  if (s === 'utilizada') return 'utilizada'
  return 'anulada'
}

export function isValidUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value.trim())
}

export function getTicketStatusMeta(status) {
  const normalized = normalizeTicketStatus(status)
  if (normalized === 'valida') {
    return {
      key: 'valida',
      label: 'Válida',
      voucherLabel: 'ENTRADA VÁLIDA',
      icon: 'check',
      badgeClass: 'ticket-badge--valid'
    }
  }
  if (normalized === 'utilizada') {
    return {
      key: 'utilizada',
      label: 'Utilizada',
      voucherLabel: 'ENTRADA UTILIZADA',
      icon: 'check_circle',
      badgeClass: 'ticket-badge--used'
    }
  }
  return {
    key: 'anulada',
    label: 'Anulada',
    voucherLabel: 'ENTRADA ANULADA',
    icon: 'close',
    badgeClass: 'ticket-badge--canceled'
  }
}

export async function downloadVoucherPng({
  nombreEvento,
  fechaTexto,
  ubicacionTexto,
  codigoCorto,
  nombreTitular,
  precioTexto,
  estadoTexto,
  qrDataUrl
}) {
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 1040
  const ctx = canvas.getContext('2d')

  // Fondo blanco redondeado
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(0, 0, 720, 1040, 32)
  ctx.fill()

  // Cabecera morada
  const grad = ctx.createLinearGradient(0, 0, 720, 260)
  grad.addColorStop(0, '#3b289c')
  grad.addColorStop(1, '#5038b9')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.roundRect(0, 0, 720, 255, [32, 32, 0, 0])
  ctx.fill()

  ctx.fillStyle = '#ffdc83'
  ctx.font = 'bold 18px Arial'
  ctx.fillText('EventosPeruIA', 48, 58)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 30px Arial'
  ctx.fillText((nombreEvento || '').slice(0, 36), 48, 112)

  ctx.fillStyle = '#e9dcff'
  ctx.font = '19px Arial'
  ctx.fillText(`📅  ${fechaTexto}`, 48, 162)
  ctx.fillText(`📍  ${(ubicacionTexto || '').slice(0, 46)}`, 48, 200)

  // Línea punteada
  ctx.strokeStyle = '#e7e0f2'
  ctx.lineWidth = 3
  ctx.setLineDash([10, 10])
  ctx.beginPath()
  ctx.moveTo(32, 275)
  ctx.lineTo(688, 275)
  ctx.stroke()
  ctx.setLineDash([])

  // Píldora de estado
  ctx.fillStyle = '#e1f7ea'
  ctx.beginPath()
  ctx.roundRect(220, 310, 280, 44, 22)
  ctx.fill()
  ctx.fillStyle = '#157a44'
  ctx.font = 'bold 17px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(`✓  ${estadoTexto}`, 360, 338)

  // Código QR
  if (qrDataUrl) {
    const img = new Image()
    img.src = qrDataUrl
    await new Promise((resolve) => {
      img.onload = resolve
      img.onerror = resolve
    })
    ctx.strokeStyle = '#e7e0f2'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(215, 385, 290, 290, 24)
    ctx.stroke()
    ctx.drawImage(img, 235, 405, 250, 250)
  }

  // Código TCK debajo del QR
  ctx.fillStyle = '#665e79'
  ctx.font = 'bold 21px monospace'
  ctx.fillText(codigoCorto || '', 360, 718)

  // Cajas Titular y Precio
  ctx.fillStyle = '#f5f1fc'
  ctx.beginPath()
  ctx.roundRect(48, 765, 295, 110, 20)
  ctx.roundRect(377, 765, 295, 110, 20)
  ctx.fill()

  ctx.fillStyle = '#665e79'
  ctx.font = '16px Arial'
  ctx.fillText('Titular', 195, 808)
  ctx.fillText('Precio', 524, 808)

  ctx.fillStyle = '#231b3c'
  ctx.font = 'bold 21px Arial'
  ctx.fillText((nombreTitular || '').slice(0, 22), 195, 845)
  ctx.fillText(precioTexto || '', 524, 845)

  // Footer
  ctx.fillStyle = '#665e79'
  ctx.font = '15px Arial'
  ctx.fillText('EventosPeruIA © 2026 · No transferible', 360, 965)

  const link = document.createElement('a')
  link.download = `${codigoCorto || 'entrada'}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}