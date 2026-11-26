<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Html5Qrcode } from 'html5-qrcode'
import { eventService } from '@/services/eventService'
import { ticketService } from '@/services/ticketService'
import { session } from '@/stores/authStore'
import { date } from '@/utils/formatters'

const route = useRoute()
const eventId = Number(route.params.eventoId)

const event = ref(null)
const loadingEvent = ref(true)
const isAuthorizedOrganizer = ref(false)
const accessError = ref('')

const checkedInCount = ref(0)
const recentLogs = ref([])

// Detecta si el evento ya finalizó o fue cancelado
const isEventConcluded = computed(() => {
  if (!event.value) return false
  const st = (event.value.status || '').toLowerCase()
  if (st.includes('final') || st.includes('cancel')) return true
  const rawEnd = event.value.endDate || event.value.startDate
  if (!rawEnd) return false
  const endDate = new Date(rawEnd)
  return !Number.isNaN(endDate.getTime()) && endDate < new Date()
})

const soldTicketsCount = computed(() => {
  if (!event.value) return 0
  return Math.max(0, Number(event.value.capacity ?? 0) - Number(event.value.availableSpots ?? 0))
})

const attendanceRate = computed(() => {
  if (!soldTicketsCount.value) return 0
  return Math.min(100, Math.round((checkedInCount.value / soldTicketsCount.value) * 100))
})

// Input exclusivo para ingreso manual (contingencia)
const manualCode = ref('')

// Estados de feedback visual tipo terminal de puerta
const busy = ref(false)
const feedbackState = ref('idle') // 'idle' | 'scanning' | 'approved' | 'rejected'
const feedbackData = reactive({
  title: '',
  message: '',
  holder: '',
  code: '',
  method: 'QR',
  time: null
})
let feedbackTimer = null

// Control de cámara QR real (html5-qrcode)
const cameraActive = ref(false)
const cameraError = ref('')
let html5QrCode = null
let lastScannedCode = ''
let lastScannedAt = 0

function playScannerTone(type) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'approved') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.09)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
    } else {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, ctx.currentTime)
      osc.frequency.setValueAtTime(165, ctx.currentTime + 0.14)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32)
      osc.start()
      osc.stop(ctx.currentTime + 0.32)
    }
  } catch {
    // Ignorar si el navegador bloquea audio sin interacción previa
  }
}

function showFeedback(state, payload, autoHideMs = 2800) {
  clearTimeout(feedbackTimer)
  feedbackState.value = state
  Object.assign(feedbackData, {
    title: payload.title || '',
    message: payload.message || '',
    holder: payload.holder || '',
    code: payload.code || '',
    method: payload.method || 'QR',
    time: payload.time || new Date().toISOString()
  })

  if (state === 'approved' || state === 'rejected') {
    playScannerTone(state)
  }

  if (autoHideMs > 0) {
    feedbackTimer = setTimeout(() => {
      feedbackState.value = 'idle'
    }, autoHideMs)
  }
}

function dismissFeedback() {
  clearTimeout(feedbackTimer)
  feedbackState.value = 'idle'
}

async function loadEventInfo() {
  loadingEvent.value = true
  accessError.value = ''
  try {
    const detail = await eventService.getEventById(eventId)
    event.value = detail

    const myName = `${session.user?.firstName || ''} ${session.user?.lastName || ''}`
      .trim()
      .toLowerCase()
    const myId = session.user?.userId || session.user?.id

    isAuthorizedOrganizer.value = Boolean(
      (myId && detail?.organizerId === myId) ||
        (myName && (detail?.organizer || '').trim().toLowerCase() === myName)
    )

    if (!isAuthorizedOrganizer.value) {
      accessError.value =
        'Acceso denegado: solo el organizador que administra este evento puede realizar el Check-in.'
    } else {
      try {
        const stats = await eventService.getEventAttendees(eventId, {
          pagina: 1,
          tamanoPagina: 1
        })
        checkedInCount.value =
          stats?.checkInsRealizados ?? stats?.utilizadas ?? stats?.Utilizadas ?? 0
      } catch {
        // Mantiene 0 si falla el endpoint auxiliar
      }
    }
  } catch (e) {
    accessError.value = e.message
  } finally {
    loadingEvent.value = false
  }
}

async function startCamera() {
  if (isEventConcluded.value) return
  cameraError.value = ''
  try {
    html5QrCode = new Html5Qrcode('qr-reader-box')
    cameraActive.value = true
    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: { width: 240, height: 240 } },
      async (decodedText) => {
        const cleanCode = decodedText.trim()
        const now = Date.now()
        if (busy.value) return
        if (cleanCode === lastScannedCode && now - lastScannedAt < 3000) return

        lastScannedCode = cleanCode
        lastScannedAt = now

        await processValidation(cleanCode, 'QR')
      },
      () => {}
    )
  } catch {
    cameraActive.value = false
    cameraError.value =
      'No se pudo acceder a la cámara (verifica permisos del navegador o usa el ingreso manual).'
  }
}

async function stopCamera() {
  if (html5QrCode && cameraActive.value) {
    try {
      await html5QrCode.stop()
      html5QrCode.clear()
    } catch {
      // Ignorar al desmontar
    }
  }
  cameraActive.value = false
}

async function processValidation(rawCode, method) {
  if (isEventConcluded.value) return
  const code = (rawCode || '').trim()
  if (!code) {
    showFeedback(
      'rejected',
      {
        title: 'Código vacío',
        message: 'Ingresa un código corto (TCK-...) o UUID antes de validar.',
        method
      },
      2400
    )
    return
  }

  busy.value = true
  showFeedback(
    'scanning',
    {
      title: 'Validando entrada...',
      message: 'Verificando autenticidad y estado en puerta',
      code,
      method
    },
    0
  )

  try {
    const payload = {
      eventoId: eventId,
      codigoTicket: code,
      metodoIngreso: method,
      validadoPorId: session.user?.userId || session.user?.id || 1,
      dispositivo: method === 'QR' ? 'Escáner Cámara Web' : 'Terminal Manual'
    }

    const res = await ticketService.validateQr(payload)
    checkedInCount.value += 1

    const shortCode = res.codigoCorto || code
    const holderName = res.titular || 'Asistente verificado'
    const validatedAt = res.fechaUso || res.fechaValidacion || new Date().toISOString()

    showFeedback('approved', {
      title: '¡ACCESO APROBADO!',
      message: res.message || 'Entrada validada correctamente.',
      holder: holderName,
      code: shortCode,
      method,
      time: validatedAt
    })

    recentLogs.value.unshift({
      ok: true,
      code: shortCode,
      holder: holderName,
      method,
      time: validatedAt
    })

    if (method === 'Manual') {
      manualCode.value = ''
    }
  } catch (e) {
    const reason = e.message || 'Entrada inválida o ya utilizada.'

    showFeedback(
      'rejected',
      {
        title: 'ACCESO RECHAZADO',
        message: reason,
        code,
        method,
        time: new Date().toISOString()
      },
      3200
    )

    recentLogs.value.unshift({
      ok: false,
      code,
      reason,
      method,
      time: new Date().toISOString()
    })
  } finally {
    busy.value = false
  }
}

onMounted(loadEventInfo)
onBeforeUnmount(() => {
  clearTimeout(feedbackTimer)
  stopCamera()
})
</script>

<template>
  <q-page class="container">
    <router-link
      :to="{ path: '/organizador/asistentes', query: { evento: eventId } }"
      class="back-link"
    >
      ← Volver a gestión de asistentes
    </router-link>

    <div class="eyebrow">
      {{ isEventConcluded ? 'RESUMEN DE ASISTENCIA · EVENTO CONCLUIDO' : 'CONTROL DE ACCESO EN PUERTA · HU-12' }}
    </div>
    <h1 class="page-heading">
      {{ isEventConcluded ? 'Resumen de Check-in' : 'Check-in' }}:
      {{ event?.name || route.query.name || 'Cargando evento...' }}
    </h1>

    <q-banner v-if="accessError" class="error" role="alert" style="margin-bottom: 20px;">
      {{ accessError }}
    </q-banner>

    <div v-if="loadingEvent" class="empty"><q-spinner /> Verificando permisos de organizador…</div>

    <template v-else-if="isAuthorizedOrganizer">
      <!-- Resumen de conteo de asistentes ingresados -->
      <div
        class="surface"
        style="margin-bottom: 20px; display: flex; gap: 24px; flex-wrap: wrap; align-items: center; justify-content: space-between;"
      >
        <div>
          <small class="muted">ASISTENTES INGRESADOS (TOTAL EN PUERTA)</small>
          <h2 style="margin: 4px 0 0;">{{ checkedInCount }} ingresados</h2>
        </div>
        <div v-if="event">
          <small class="muted">AFORO DEL EVENTO</small>
          <p style="margin: 4px 0 0;">
            <strong>{{ soldTicketsCount }}</strong> vendidos de
            <strong>{{ event.capacity }}</strong> cupos totales
          </p>
        </div>
        <div v-if="isEventConcluded">
          <small class="muted">TASA DE ASISTENCIA</small>
          <p style="margin: 4px 0 0; font-size: 1.15rem; font-weight: 800; color: #16a34a;">
            {{ attendanceRate }}% de asistencia efectiva
          </p>
        </div>
      </div>

      <!-- MODO RESUMEN CUANDO EL EVENTO YA CONCLUYÓ -->
      <section
        v-if="isEventConcluded"
        class="surface"
        style="padding: 28px; border-radius: 18px;"
      >
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <q-icon name="event_available" size="30px" color="blue-grey-7" />
          <div>
            <h3 style="margin: 0; font-size: 1.2rem;">Control de puerta cerrado</h3>
            <p class="muted" style="margin: 2px 0 0;">
              Este evento concluyó el {{ date(event?.endDate || event?.startDate) }}, por lo que el escáner QR y el registro manual ya no están habilitados.
            </p>
          </div>
        </div>

        <q-linear-progress
          :value="attendanceRate / 100"
          rounded
          size="10px"
          color="positive"
          track-color="grey-3"
          style="margin: 16px 0;"
        />

        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px;">
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="people"
            label="Ver listado completo de asistentes"
            :to="{ path: '/organizador/asistentes', query: { evento: eventId } }"
          />
          <q-btn
            outline
            no-caps
            color="grey-8"
            icon="arrow_back"
            label="Volver a Mis eventos"
            to="/organizador/mis-eventos"
          />
        </div>
      </section>

      <!-- MODO ESCÁNER ACTIVO CUANDO EL EVENTO SIGUE VIGENTE -->
      <div v-else class="detail-top">
        <!-- Panel Izquierdo: Escáner de Cámara QR Real -->
        <section class="surface">
          <h3 style="margin-top: 0;">1. Escaneo con Cámara QR</h3>
          <p class="muted">
            Apunta la cámara al código QR del asistente; la lectura es automática.
          </p>

          <div style="margin-bottom: 12px; display: flex; gap: 8px;">
            <q-btn
              v-if="!cameraActive"
              unelevated
              no-caps
              color="primary"
              icon="photo_camera"
              label="Activar cámara QR"
              @click="startCamera"
            />
            <q-btn
              v-else
              outline
              no-caps
              color="negative"
              icon="videocam_off"
              label="Detener cámara"
              @click="stopCamera"
            />
          </div>

          <div
            class="scanner-frame"
            :class="{
              'frame-scanning': feedbackState === 'scanning',
              'frame-approved': feedbackState === 'approved',
              'frame-rejected': feedbackState === 'rejected'
            }"
          >
            <div id="qr-reader-box" style="width: 100%; background: #111;"></div>
          </div>

          <q-banner v-if="cameraError" class="error" style="margin-top: 12px;">
            {{ cameraError }}
          </q-banner>
        </section>

        <!-- Panel Derecho: Ingreso Manual Alfanumérico -->
        <section class="surface">
          <h3 style="margin-top: 0;">2. Ingreso Manual (Contingencia)</h3>
          <p class="muted">
            Si el QR no es legible, digita el código corto (ej. <code>TCK-B1EEBC999C</code>) o el UUID.
          </p>

          <q-form @submit.prevent="processValidation(manualCode, 'Manual')" class="form-stack">
            <q-input
              outlined
              v-model="manualCode"
              label="Código corto (TCK-...) o UUID de entrada"
              placeholder="Ej. TCK-8D23B83518"
              clearable
            />

            <q-btn
              type="submit"
              unelevated
              no-caps
              color="primary"
              icon="verified"
              label="Validar ingreso manual"
              :loading="busy"
            />
          </q-form>

          <div
            v-if="recentLogs.length"
            class="last-scan-pill"
            :class="recentLogs[0].ok ? 'pill-ok' : 'pill-err'"
          >
            <strong>
              {{ recentLogs[0].ok ? '✓ Último aprobado:' : '✕ Último rechazado:' }}
              {{ recentLogs[0].code }}
            </strong>
            <span>{{ recentLogs[0].ok ? recentLogs[0].holder : recentLogs[0].reason }}</span>
          </div>
        </section>
      </div>

      <!-- Historial rápido de validaciones en puerta -->
      <section v-if="recentLogs.length && !isEventConcluded" class="surface" style="margin-top: 20px;">
        <h3 style="margin-top: 0;">Últimas lecturas en puerta</h3>
        <article
          v-for="(log, idx) in recentLogs"
          :key="idx"
          class="review"
          style="display: flex; justify-content: space-between; align-items: center;"
        >
          <div>
            <strong :style="{ color: log.ok ? '#15803d' : '#b91c1c' }">
              {{ log.ok ? '✓ Aprobado' : '✕ Rechazado' }} · {{ log.code }}
            </strong>
            <p style="margin: 2px 0 0;">
              {{ log.ok ? log.holder : log.reason }} ({{ log.method }})
            </p>
          </div>
          <small>{{ date(log.time) }}</small>
        </article>
      </section>
    </template>

    <!-- OVERLAY DE REACCIÓN EN PANTALLA -->
    <transition name="pop-fade">
      <div
        v-if="feedbackState !== 'idle'"
        class="gate-overlay"
        :class="`gate-${feedbackState}`"
        @click="dismissFeedback"
      >
        <div class="gate-card" @click.stop>
          <template v-if="feedbackState === 'scanning'">
            <q-spinner-dots color="grey-8" size="52px" />
            <h2 class="gate-title">{{ feedbackData.title }}</h2>
            <p class="gate-sub">{{ feedbackData.message }}</p>
            <div class="gate-code">{{ feedbackData.code }}</div>
          </template>

          <template v-else-if="feedbackState === 'approved'">
            <div class="gate-icon-circle approved-circle">
              <q-icon name="check" size="48px" color="white" />
            </div>
            <h2 class="gate-title text-positive">{{ feedbackData.title }}</h2>
            <p class="gate-holder">{{ feedbackData.holder }}</p>
            <div class="gate-code">{{ feedbackData.code }} · {{ feedbackData.method }}</div>
            <p class="gate-sub">{{ date(feedbackData.time) }}</p>
          </template>

          <template v-else-if="feedbackState === 'rejected'">
            <div class="gate-icon-circle rejected-circle">
              <q-icon name="close" size="48px" color="white" />
            </div>
            <h2 class="gate-title text-negative">{{ feedbackData.title }}</h2>
            <p class="gate-reason">{{ feedbackData.message }}</p>
            <div v-if="feedbackData.code" class="gate-code">{{ feedbackData.code }}</div>
          </template>

          <q-btn
            v-if="feedbackState !== 'scanning'"
            flat
            no-caps
            size="sm"
            color="grey-7"
            label="Continuar escaneando"
            style="margin-top: 12px;"
            @click="dismissFeedback"
          />
        </div>
      </div>
    </transition>
  </q-page>
</template>

<style scoped>
.scanner-frame {
  width: 100%;
  max-width: 360px;
  border-radius: 14px;
  overflow: hidden;
  border: 3px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.frame-scanning {
  border-color: #64748b;
  box-shadow: 0 0 0 4px rgba(100, 116, 139, 0.25);
}

.frame-approved {
  border-color: #16a34a;
  box-shadow: 0 0 0 6px rgba(22, 163, 74, 0.28);
}

.frame-rejected {
  border-color: #dc2626;
  box-shadow: 0 0 0 6px rgba(220, 38, 38, 0.28);
}

.last-scan-pill {
  margin-top: 16px;
  padding: 10px 14px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.pill-ok {
  background: #ecfdf5;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.pill-err {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.gate-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  backdrop-filter: blur(4px);
  transition: background-color 0.2s ease;
}

.gate-scanning {
  background: rgba(15, 23, 42, 0.45);
}

.gate-approved {
  background: rgba(20, 83, 45, 0.72);
}

.gate-rejected {
  background: rgba(127, 29, 29, 0.75);
}

.gate-card {
  background: #ffffff;
  border-radius: 22px;
  padding: 32px 28px;
  width: 100%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.28);
}

.gate-approved .gate-card {
  border-top: 8px solid #16a34a;
  animation: popScale 0.25s ease-out;
}

.gate-rejected .gate-card {
  border-top: 8px solid #dc2626;
  animation: shakeCard 0.35s ease-in-out;
}

.gate-icon-circle {
  width: 82px;
  height: 82px;
  border-radius: 50%;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.approved-circle {
  background: #16a34a;
  box-shadow: 0 10px 24px rgba(22, 163, 74, 0.4);
}

.rejected-circle {
  background: #dc2626;
  box-shadow: 0 10px 24px rgba(220, 38, 38, 0.4);
}

.gate-title {
  font-size: 24px;
  font-weight: 800;
  margin: 8px 0 6px;
  letter-spacing: -0.02em;
}

.gate-holder {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.gate-reason {
  font-size: 15px;
  font-weight: 500;
  color: #991b1b;
  margin: 0 0 10px;
}

.gate-code {
  display: inline-block;
  background: #f1f5f9;
  color: #334155;
  font-family: monospace;
  font-weight: 700;
  font-size: 14px;
  padding: 4px 12px;
  border-radius: 999px;
  margin-bottom: 6px;
}

.gate-sub {
  font-size: 13px;
  color: #64748b;
  margin: 4px 0 0;
}

.pop-fade-enter-active,
.pop-fade-leave-active {
  transition: opacity 0.2s ease;
}

.pop-fade-enter-from,
.pop-fade-leave-to {
  opacity: 0;
}

@keyframes popScale {
  0% {
    transform: scale(0.86);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes shakeCard {
  0%,
  100% {
    transform: translateX(0);
  }
  20%,
  60% {
    transform: translateX(-10px);
  }
  40%,
  80% {
    transform: translateX(10px);
  }
}
</style>