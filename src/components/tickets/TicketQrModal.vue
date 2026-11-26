<script setup>
import { computed, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { date, money } from '@/utils/formatters'
import { downloadVoucherPng, getTicketStatusMeta, isValidUuid } from '@/utils/ticketHelpers'

const props = defineProps({
  ticket: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])
const qrDataUrl = ref('')
const downloading = ref(false)

const statusMeta = computed(() =>
  getTicketStatusMeta(props.ticket?.estadoEntrada || props.ticket?.estado)
)

const isValid = computed(() => statusMeta.value.key === 'valida')
const isUsed = computed(() => statusMeta.value.key === 'utilizada')
const isCanceled = computed(() => statusMeta.value.key === 'anulada')

const qrPayload = computed(() => {
  const payload = props.ticket?.qrPayload

  if (props.ticket?.estaActiva !== true || !isValid.value) return ''
  if (typeof payload !== 'string' || !isValidUuid(payload.trim())) return ''

  return payload.trim()
})

const showQr = computed(() => Boolean(qrPayload.value && qrDataUrl.value))

const formattedDate = computed(() =>
  date(props.ticket?.fechaYHora || props.ticket?.fechaEvento)
)

const formattedLocation = computed(() => {
  if (!props.ticket) return ''
  return props.ticket.ciudad
    ? `${props.ticket.ubicacion}, ${props.ticket.ciudad}`
    : props.ticket.ubicacion
})

const formattedPrice = computed(() =>
  money(props.ticket?.montoPagado ?? props.ticket?.precio, 'PEN')
)

watch(
  [() => props.ticket, qrPayload],
  async ([, payload], _, onCleanup) => {
    qrDataUrl.value = ''
    if (!payload) return

    let vigente = true
    onCleanup(() => {
      vigente = false
    })

    try {
      const dataUrl = await QRCode.toDataURL(payload, {
        width: 220,
        margin: 1,
        color: { dark: '#181434', light: '#ffffff' }
      })

      if (vigente) qrDataUrl.value = dataUrl
    } catch {
      if (vigente) qrDataUrl.value = ''
    }
  },
  { immediate: true, flush: 'sync' }
)

async function handleDownload() {
  if (!props.ticket || !showQr.value || downloading.value) return
  downloading.value = true
  try {
    await downloadVoucherPng({
      nombreEvento: props.ticket.nombreEvento,
      fechaTexto: formattedDate.value,
      ubicacionTexto: formattedLocation.value,
      codigoCorto: props.ticket.codigoCorto,
      nombreTitular: props.ticket.nombreTitular,
      precioTexto: formattedPrice.value,
      estadoTexto: statusMeta.value.voucherLabel,
      qrDataUrl: qrDataUrl.value
    })
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <q-dialog
    :model-value="!!ticket"
    backdrop-filter="blur(6px)"
    @update:model-value="emit('close')"
  >
    <div v-if="ticket" class="voucher-shell">
      <!-- Barra superior tipo Figma -->
      <div class="voucher-nav">
        <button type="button" class="voucher-nav__action" @click="emit('close')">
          <q-icon name="arrow_back" size="18px" />
          <span>Mis entradas</span>
        </button>

        <button
          v-if="showQr"
          type="button"
          class="voucher-nav__action"
          :disabled="downloading"
          @click="handleDownload"
        >
          <q-icon name="download" size="18px" />
          <span>{{ downloading ? 'Descargando…' : 'Descargar' }}</span>
        </button>
      </div>

      <!-- Tarjeta principal del ticket -->
      <q-card class="voucher-ticket">
        <div class="voucher-ticket__head">
          <div class="voucher-ticket__decor" />
          <div class="voucher-ticket__brand">
            <span class="voucher-ticket__brand-icon">
              <q-icon name="auto_awesome" size="16px" />
            </span>
            <strong>EventosPeruIA</strong>
          </div>

          <h3 class="voucher-ticket__title">{{ ticket.nombreEvento }}</h3>

          <div class="voucher-ticket__meta">
            <div>
              <q-icon name="calendar_today" size="14px" />
              <span>{{ formattedDate }}</span>
            </div>
            <div>
              <q-icon name="location_on" size="14px" />
              <span>{{ formattedLocation }}</span>
            </div>
          </div>
        </div>

        <!-- Perforación lateral -->
        <div class="voucher-ticket__cut">
          <span class="voucher-ticket__notch voucher-ticket__notch--left" />
          <div class="voucher-ticket__dashed" />
          <span class="voucher-ticket__notch voucher-ticket__notch--right" />
        </div>

        <div class="voucher-ticket__body">
          <!-- Píldora de estado centrada -->
          <div class="voucher-ticket__status-wrap">
            <span
              class="voucher-status"
              :class="{
                'voucher-status--valid': isValid,
                'voucher-status--used': isUsed,
                'voucher-status--canceled': isCanceled
              }"
            >
              <q-icon :name="statusMeta.icon" size="15px" />
              <span>{{ statusMeta.voucherLabel }}</span>
            </span>
          </div>

          <!-- Aviso si está anulada / pendiente de reembolso -->
          <div v-if="isCanceled" class="voucher-ticket__refund">
            <q-icon name="info" size="18px" />
            <div>
              <strong>{{ ticket.pendienteReembolso ? 'Pendiente de reembolso' : 'Entrada anulada' }}</strong>
              <p v-if="ticket.motivoCancelacion">{{ ticket.motivoCancelacion }}</p>
            </div>
          </div>

          <!-- QR + TCK debajo del QR -->
          <div class="voucher-ticket__qr-area">
            <div v-if="showQr" class="voucher-ticket__qr-frame">
              <img :src="qrDataUrl" alt="Código QR de entrada" width="215" height="215" />
            </div>

            <div v-else class="voucher-ticket__qr-disabled">
              <q-icon :name="isUsed ? 'check_circle' : 'block'" size="40px" />
              <strong>{{ isUsed ? 'QR ya utilizado' : 'QR deshabilitado' }}</strong>
              <span>
                {{
                  isUsed
                    ? 'Esta entrada ya registró su ingreso en puerta.'
                    : isCanceled
                      ? 'Esta entrada fue anulada y no es válida para ingresar.'
                      : 'No hay un código QR disponible para esta entrada.'
                }}
              </span>
            </div>

            <div class="voucher-ticket__code">{{ ticket.codigoCorto }}</div>
          </div>

          <!-- Banner morado suave -->
          <div v-if="showQr" class="voucher-ticket__hint-box">
            <strong>Presenta este código QR al ingresar al evento</strong>
            <span>Solo válido para 1 persona</span>
          </div>

          <!-- Dos tarjetas: Titular y Precio -->
          <div class="voucher-ticket__info-grid">
            <div class="voucher-ticket__info-card">
              <small>Titular</small>
              <strong>{{ ticket.nombreTitular }}</strong>
            </div>
            <div class="voucher-ticket__info-card">
              <small>Precio</small>
              <strong>{{ formattedPrice }}</strong>
            </div>
          </div>
        </div>

        <!-- Pie del ticket -->
        <div class="voucher-ticket__foot">
          <span>EventosPeruIA © 2026 · No transferible</span>
          <router-link :to="'/evento/' + ticket.eventoId" @click="emit('close')">
            Ver evento
          </router-link>
        </div>
      </q-card>

      <!-- Nota inferior fuera de la tarjeta -->
      <p v-if="showQr" class="voucher-shell__tip">
        Mantén el brillo de tu pantalla al máximo al mostrar el QR.
      </p>
    </div>
  </q-dialog>
</template>

<style scoped>
.voucher-shell {
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.voucher-nav {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px;
}

.voucher-nav__action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 10px;
  transition: background-color 0.16s ease, opacity 0.16s ease;
}

.voucher-nav__action:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}

.voucher-nav__action:disabled {
  opacity: 0.6;
  cursor: wait;
}

.voucher-ticket {
  width: 100%;
  border-radius: 24px;
  overflow: hidden;
  background: var(--bg-primary);
  box-shadow: 0 24px 60px color-mix(in srgb, var(--text-primary) 20%, transparent);
  color: var(--text-primary);
}

.voucher-ticket__head {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%);
  color: white;
  padding: 24px 26px 22px;
}

.voucher-ticket__decor {
  position: absolute;
  top: -28px;
  right: -28px;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  pointer-events: none;
}

.voucher-ticket__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  font-size: 14px;
}

.voucher-ticket__brand-icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  display: grid;
  place-items: center;
  color: var(--gold);
}

.voucher-ticket__title {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.25;
}

.voucher-ticket__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #e9dcff;
}

.voucher-ticket__meta div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.voucher-ticket__cut {
  position: relative;
  display: flex;
  align-items: center;
  background: #ffffff;
  height: 20px;
}

.voucher-ticket__dashed {
  width: 100%;
  margin: 0 18px;
  border-top: 2px dashed var(--line);
}

.voucher-ticket__notch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-primary);
  position: absolute;
}

.voucher-ticket__notch--left {
  left: -11px;
}

.voucher-ticket__notch--right {
  right: -11px;
}

.voucher-ticket__body {
  padding: 10px 26px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.voucher-ticket__status-wrap {
  display: flex;
  justify-content: center;
}

.voucher-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 16px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.voucher-status--valid {
  background: color-mix(in srgb, var(--success) 15%, transparent);
  color: color-mix(in srgb, var(--success) 50%, var(--text-primary));
  border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
}

.voucher-status--used {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.voucher-status--canceled {
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  color: color-mix(in srgb, var(--danger) 50%, var(--text-primary));
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
}

.voucher-ticket__refund {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  color: color-mix(in srgb, var(--danger) 50%, var(--text-primary));
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 12.5px;
}

.voucher-ticket__refund p {
  margin: 2px 0 0;
}

.voucher-ticket__qr-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.voucher-ticket__qr-frame {
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 22px;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--text-primary) 5%, transparent);
}

.voucher-ticket__qr-frame img {
  display: block;
}

.voucher-ticket__qr-disabled {
  width: 100%;
  background: var(--bg-secondary);
  border: 1.5px dashed var(--border-color);
  border-radius: 18px;
  padding: 24px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}

.voucher-ticket__qr-disabled strong {
  color: var(--ink);
  font-size: 14.5px;
}

.voucher-ticket__qr-disabled span {
  font-size: 12.5px;
  max-width: 260px;
}

.voucher-ticket__code {
  font-family: monospace;
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--muted-ink);
}

.voucher-ticket__hint-box {
  width: 100%;
  background: color-mix(in srgb, var(--brand) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--brand) 30%, transparent);
  border-radius: 16px;
  padding: 12px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.voucher-ticket__hint-box strong {
  font-size: 13px;
  color: var(--brand);
}

.voucher-ticket__hint-box span {
  font-size: 12px;
  color: var(--text-secondary);
}

.voucher-ticket__info-grid {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.voucher-ticket__info-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 12px 14px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.voucher-ticket__info-card small {
  font-size: 12px;
  color: var(--text-secondary);
}

.voucher-ticket__info-card strong {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.voucher-ticket__foot {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  padding: 12px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--text-secondary);
}

.voucher-ticket__foot a {
  font-weight: 700;
}

.voucher-shell__tip {
  margin: 0;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.82);
  text-align: center;
}
</style>
