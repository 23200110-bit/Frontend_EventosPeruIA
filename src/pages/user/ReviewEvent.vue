<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { eventService } from '@/services/eventService'
import { ticketService } from '@/services/ticketService'
import { date } from '@/utils/formatters'

const route = useRoute()
const router = useRouter()

const eventId = Number(route.params.eventoId)
const event = ref(null)
const ticketInfo = ref(null)
const busy = ref(true)
const submitting = ref(false)
const error = ref('')
const success = ref('')

const form = reactive({
  ticketId: String(route.query.ticketId || ''),
  rating: 5,
  comment: ''
})

const ratingLabels = {
  1: 'Muy malo',
  2: 'Malo',
  3: 'Regular',
  4: 'Muy bueno',
  5: 'Excelente'
}

const ratingText = computed(() => ratingLabels[form.rating] || '')

const isFinished = computed(() => {
  if (!event.value) return false
  return (
    event.value.status === 'Finalizado' ||
    new Date(event.value.endDate || event.value.startDate) < new Date()
  )
})

async function load() {
  busy.value = true
  error.value = ''
  try {
    const [detail, myTickets] = await Promise.all([
      eventService.getEventById(eventId),
      ticketService.getMyTickets()
    ])
    event.value = detail

    const found = (myTickets || []).find(
      (t) =>
        (form.ticketId && (t.entradaId === form.ticketId || t.ticketId === form.ticketId)) ||
        (Number(t.eventoId ?? t.eventId) === eventId &&
          (t.estado || t.status || '').toLowerCase() === 'utilizada')
    )

    if (found) {
      ticketInfo.value = found
      form.ticketId = found.entradaId || found.ticketId
    } else if (!form.ticketId) {
      error.value = 'No se encontró una entrada utilizada para este evento en tu cuenta.'
    }
  } catch (e) {
    error.value = e.message || 'No se pudo cargar la información del evento.'
  } finally {
    busy.value = false
  }
}

async function submitReview() {
  error.value = ''
  success.value = ''

  if (!form.ticketId) {
    error.value = 'No se encontró el identificador de tu entrada utilizada.'
    return
  }

  submitting.value = true
  try {
    await eventService.createReview(eventId, {
      ticketId: form.ticketId,
      rating: form.rating,
      comment: form.comment.trim() || null
    })
    success.value = '¡Gracias! Tu reseña ha sido publicada correctamente.'
    setTimeout(() => {
      router.push(`/evento/${eventId}`)
    }, 1200)
  } catch (e) {
    error.value = e.message || 'No se pudo registrar tu reseña.'
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <q-page class="container" style="max-width: 720px;">
    <router-link to="/entradas" class="back-link">← Volver a mis entradas</router-link>

    <div class="eyebrow">CALIFICAR EXPERIENCIA · HU-13</div>
    <h1 class="page-heading" style="margin-bottom: 6px;">Reseñar evento</h1>
    <p class="muted" style="margin-bottom: 24px;">
      Comparte tu opinión con otros asistentes sobre el evento al que asististe.
    </p>

    <div v-if="busy" class="empty">
      <q-spinner color="primary" size="28px" />
      <p>Cargando datos del evento…</p>
    </div>

    <template v-else-if="event">
      <!-- Resumen compacto del evento y entrada verificada -->
      <div class="surface" style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
          <div>
            <q-badge color="primary">{{ event.category }}</q-badge>
            <h2 style="font-size: 20px; font-weight: 700; margin: 8px 0 4px;">
              {{ event.name }}
            </h2>
            <p class="muted" style="margin: 0; font-size: 13.5px;">
              {{ date(event.startDate) }} · {{ event.venue }} ({{ event.city }})
            </p>
          </div>

          <span v-if="ticketInfo?.codigoCorto" class="verified-pill">
            ✓ Entrada verificada · {{ ticketInfo.codigoCorto }}
          </span>
        </div>
      </div>

      <!-- Aviso si el evento aún no finaliza -->
      <q-banner v-if="!isFinished" class="error" role="alert" style="margin-bottom: 16px;">
        Este evento aún no ha finalizado ({{ date(event.startDate) }}). Podrás publicar tu reseña una vez que el evento haya concluido.
      </q-banner>

      <!-- Formulario dedicado de calificación -->
      <section v-else class="surface">
        <q-form class="form-stack" @submit.prevent="submitReview">
          <div>
            <label style="display: block; font-weight: 700; margin-bottom: 6px;">
              1. ¿Cómo calificarías tu experiencia?
            </label>
            <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
              <q-rating
                v-model="form.rating"
                :max="5"
                size="36px"
                color="amber-8"
                icon="star_border"
                icon-selected="star"
              />
              <span class="rating-label">{{ form.rating }} / 5 · {{ ratingText }}</span>
            </div>
          </div>

          <div>
            <label style="display: block; font-weight: 700; margin-bottom: 6px;">
              2. Cuéntanos tu experiencia (opcional)
            </label>
            <q-input
              v-model="form.comment"
              outlined
              type="textarea"
              rows="4"
              placeholder="¿Qué te pareció la organización, el lugar, el sonido o el contenido del evento?"
              maxlength="1000"
              counter
            />
          </div>

          <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>
          <q-banner v-if="success" class="success" role="status">{{ success }}</q-banner>

          <div style="display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap;">
            <q-btn
              flat
              no-caps
              color="grey-8"
              label="Cancelar"
              to="/entradas"
              :disable="submitting"
            />
            <q-btn
              type="submit"
              unelevated
              no-caps
              color="primary"
              icon="send"
              label="Publicar reseña"
              :loading="submitting"
            />
          </div>
        </q-form>
      </section>
    </template>
  </q-page>
</template>

<style scoped>
.verified-pill {
  background: #e1f7ea;
  color: #157a44;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  font-family: monospace;
}

.rating-label {
  background: #fff4d6;
  color: #8a5a00;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}
</style>