<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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
const checkedInCount = ref(0)
const recentLogs = ref([])

const form = reactive({
  codigoTicket: '',
  metodoIngreso: 'QR'
})

const busy = ref(false)
const error = ref('')
const result = ref(null)

// Control de cámara QR real (html5-qrcode)
const cameraActive = ref(false)
const cameraError = ref('')
let html5QrCode = null
let lastScannedCode = ''
let lastScannedAt = 0

async function loadEventInfo() {loadingEvent.value = true
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
      error.value = 'Acceso denegado: solo el organizador que administra este evento puede realizar el Check-in.'
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loadingEvent.value = false
  }
}

async function startCamera() {
  cameraError.value = ''
  try {
    html5QrCode = new Html5Qrcode('qr-reader-box')
    cameraActive.value = true
    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      async decodedText => {
        const now = Date.now()
        // Evita disparar múltiples peticiones seguidas por el mismo cuadro de cámara
        if (decodedText === lastScannedCode && now - lastScannedAt < 2500) return
        lastScannedCode = decodedText
        lastScannedAt = now

        form.codigoTicket = decodedText.trim()
        form.metodoIngreso = 'QR'
        await submitValidation()
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

async function submitValidation(isManual = false) {
  error.value = ''
  result.value = null

  const code = form.codigoTicket.trim()
  if (!code) {
    error.value = 'Escanea un código QR o ingresa el código alfanumérico de la entrada.'
    return
  }

  if (isManual) {
    form.metodoIngreso = 'Manual'
  }

  busy.value = true
  try {
    const payload = {
      eventoId: eventId,
      codigoTicket: code,
      metodoIngreso: form.metodoIngreso,
      validadoPorId: session.user?.userId || session.user?.id || 1,
      dispositivo: cameraActive.value ? 'Escáner Cámara Web' : 'Terminal Manual'
    }
    const res = await ticketService.validateQr(payload)
    result.value = res
    checkedInCount.value += 1
    recentLogs.value.unshift({
      ok: true,
      code: res.codigoCorto || code,
      holder: res.titular || 'Asistente verificado',
      method: form.metodoIngreso,
      time: new Date().toISOString()
    })
    form.codigoTicket = ''
  } catch (e) {
    error.value = e.message
    recentLogs.value.unshift({
      ok: false,
      code,
      reason: e.message,
      method: form.metodoIngreso,
      time: new Date().toISOString()
    })
  } finally {
    busy.value = false
  }
}

onMounted(loadEventInfo)
onBeforeUnmount(stopCamera)
</script>

<template>
  <q-page class="container">
    <router-link to="/organizador/asistentes" class="back-link">
      ← Volver a gestión de asistentes
    </router-link>

    <div class="eyebrow">CONTROL DE ACCESO EN PUERTA · HU-12</div>
    <h1 class="page-heading">
      Check-in: {{ event?.name || route.query.name || 'Cargando evento...' }}
    </h1>

    <!-- Resumen de conteo de asistentes ingresados -->
    <div class="surface" style="margin-bottom: 20px; display: flex; gap: 24px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
      <div>
        <small class="muted">ASISTENTES INGRESADOS EN ESTA SESIÓN</small>
        <h2 style="margin: 4px 0 0;">{{ checkedInCount }} ingresados</h2>
      </div>
      <div v-if="event">
        <small class="muted">AFORO DEL EVENTO</small>
        <p style="margin: 4px 0 0;">
          <strong>{{ event.capacity - event.availableSpots }}</strong> vendidos de
          <strong>{{ event.capacity }}</strong> cupos totales
        </p>
      </div>
    </div>

    <div class="detail-top">
      <!-- Panel Izquierdo: Escáner de Cámara QR Real -->
      <section class="surface">
        <h3 style="margin-top: 0;">1. Escaneo con Cámara QR</h3>
        <p class="muted">
          Apunta la cámara del dispositivo al código QR de la entrada del asistente.
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
          id="qr-reader-box"
          style="width: 100%; max-width: 360px; border-radius: 12px; overflow: hidden; background: #111;"
        ></div>

        <q-banner v-if="cameraError" class="error" style="margin-top: 12px;">
          {{ cameraError }}
        </q-banner>
      </section>

      <!-- Panel Derecho: Ingreso Manual Alfanumérico y Resultado -->
      <section class="surface">
        <h3 style="margin-top: 0;">2. Ingreso Manual (Contingencia)</h3>
        <p class="muted">
          Si el QR no es legible, digita el código corto (ej. <code>TCK-B1EEBC999C</code>) o el UUID.
        </p>

        <q-form @submit.prevent="submitValidation(true)" class="form-stack">
          <q-input
            outlined
            v-model="form.codigoTicket"
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

        <!-- Resultado Aprobado -->
        <q-banner v-if="result" class="success" role="status" style="margin-top: 16px;">
          <div><strong>✓ CHECK-IN APROBADO</strong></div>
          <div>{{ result.message || 'Ingreso autorizado correctamente.' }}</div>
          <div v-if="result.titular"><strong>Titular:</strong> {{ result.titular }}</div>
          <div v-if="result.codigoCorto"><strong>Ticket:</strong> {{ result.codigoCorto }}</div>
          <div><strong>Fecha y hora:</strong> {{ date(result.fechaUso || new Date()) }}</div>
        </q-banner>

        <!-- Resultado Rechazado -->
        <q-banner v-if="error" class="error" role="alert" style="margin-top: 16px;">
          <div><strong>✕ CHECK-IN RECHAZADO</strong></div>
          <div>{{ error }}</div>
        </q-banner>
      </section>
    </div>

    <!-- Historial rápido de validaciones en puerta -->
    <section v-if="recentLogs.length" class="surface" style="margin-top: 20px;">
      <h3 style="margin-top: 0;">Últimas lecturas en puerta</h3>
      <article
        v-for="(log, idx) in recentLogs"
        :key="idx"
        class="review"
        style="display: flex; justify-content: space-between; align-items: center;"
      >
        <div>
          <strong :style="{ color: log.ok ? '#1b7a3d' : '#b42318' }">
            {{ log.ok ? '✓ Aprobado' : '✕ Rechazado' }} · {{ log.code }}
          </strong>
          <p style="margin: 2px 0 0;">
            {{ log.ok ? log.holder : log.reason }} ({{ log.method }})
          </p>
        </div>
        <small>{{ date(log.time) }}</small>
      </article>
    </section>
  </q-page>
</template>