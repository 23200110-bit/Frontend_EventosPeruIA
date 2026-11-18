<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EventCard from '@/components/events/EventCard.vue'
import { eventService } from '@/services/eventService'
import { ticketService } from '@/services/ticketService'
import { session } from '@/stores/authStore'
import { date, money } from '@/utils/formatters'
import { required } from '@/utils/validators'

const route = useRoute()
const router = useRouter()

const event = ref(null)
const summary = ref(null)
const relatedEvents = ref([])
const busy = ref(true)
const error = ref('')
const reviewError = ref('')
const reviewSuccess = ref('')

let timer = null

const review = reactive({
  ticketId: '',
  rating: 5,
  comment: ''
})

// [AGREGADO HU-06 / HU-13] Estados computados del evento
const isFinished = computed(() => {
  if (!event.value) return false
  return (
    event.value.status === 'Finalizado' ||
    new Date(event.value.endDate || event.value.startDate) < new Date()
  )
})

const isSoldOut = computed(() => {
  if (!event.value) return false
  return event.value.isSoldOut || (event.value.availableSpots ?? 0) <= 0
})

const isCancelled = computed(() => event.value?.status === 'Cancelado')

// [AGREGADO HU-13] Solo muestra la caja de reseñas si el evento ya finalizó o tiene reseñas
const showReviewsSection = computed(
  () => isFinished.value || (summary.value?.totalReviews ?? 0) > 0
)

async function refresh() {
  try {
    event.value = await eventService.getEventById(route.params.id)
  } catch (e) {
    error.value = e.message
  }
}

// [AGREGADO HU-13] Autocompleta el UUID de entrada utilizada desde URL o desde Mis Entradas
async function detectUserUsedTicket(eventId) {
  if (route.query.ticketId) {
    review.ticketId = String(route.query.ticketId)
    return
  }
  if (!session.user) return
  try {
    const myTickets = await ticketService.getMyTickets()
    const used = (myTickets || []).find(
      (t) =>
        Number(t.eventoId ?? t.eventId) === Number(eventId) &&
        (t.estado || t.status || '').toLowerCase() === 'utilizada'
    )
    if (used?.entradaId || used?.ticketId) {
      review.ticketId = used.entradaId || used.ticketId
    }
  } catch {
    // Si falla la detección automática, el campo sigue disponible para ingreso manual
  }
}

// [AGREGADO HU-06 / HU-13] Carga hasta 3 próximos eventos excluyendo el actual
async function loadRelatedEvents(currentId) {
  try {
    const res = await eventService.searchEvents({ page: 1, pageSize: 6 })
    const list = Array.isArray(res) ? res : res?.items || []
    relatedEvents.value = list.filter((e) => Number(e.id) !== Number(currentId)).slice(0, 3)
  } catch {
    relatedEvents.value = []
  }
}

async function load() {
  busy.value = true
  error.value = ''
  reviewError.value = ''
  reviewSuccess.value = ''

  review.ticketId = ''

  try {
    const id = route.params.id
    event.value = await eventService.getEventById(id)
    summary.value = await eventService.getEventReviews(id)
    await Promise.all([detectUserUsedTicket(id), loadRelatedEvents(id)])
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function sendReview() {
  reviewError.value = ''
  reviewSuccess.value = ''
  try {
    const id = route.params.id
    await eventService.createReview(id, review)
    reviewSuccess.value = 'Tu reseña fue registrada.'
    summary.value = await eventService.getEventReviews(id)
    review.comment = ''
  } catch (e) {
    reviewError.value = e.message
  }
}

// [AGREGADO HU-06] Acción del botón Comprar entrada en el panel derecho
function handleBuyAction() {
  if (isSoldOut.value || isCancelled.value) return
  if (!session.user) {
    router.push({ path: '/login', query: { next: `/evento/${event.value.id}/comprar` } })
    return
  }
  router.push(`/evento/${event.value.id}/comprar`)
}

// [AGREGADO HU-06] Recarga datos si el usuario hace clic en uno de los eventos sugeridos abajo
watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) load()
  }
)

onMounted(async () => {
  await load()
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') refresh()
  }, 15000)
})

onBeforeUnmount(() => {
  clearInterval(timer)
})
</script>

<template>
  <q-page class="container">
    <router-link to="/explorar" class="back-link">← Volver a explorar</router-link>

    <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>
    <div v-if="busy" class="empty"><q-spinner /> Cargando evento…</div>

    <template v-if="event">
      <div class="detail-top">
        <div>
          <div class="eyebrow">{{ event.category }} · {{ event.city }}</div>
          <h1 class="page-heading">{{ event.name }}</h1>

          <!-- [AGREGADO HU-06 / HU-13] Badges de estado, agotado y calificación promedio -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
            <q-badge :color="isCancelled ? 'negative' : 'primary'">{{ event.status }}</q-badge>
            <q-badge v-if="isSoldOut && !isCancelled" color="grey-8">Agotado</q-badge>
            <q-badge v-if="summary?.totalReviews" color="amber-8" text-color="black">
              ★ {{ summary.averageRating }} ({{ summary.totalReviews }})
            </q-badge>
          </div>

          <p class="detail-description">{{ event.description }}</p>

          <div class="surface">
            <h2 class="section-card-title">Todo lo que necesitas saber</h2>
            <p><strong>Cuándo:</strong> {{ date(event.startDate) }}</p>
            <p><strong>Dónde:</strong> {{ event.venue }} · {{ event.address }}, {{ event.city }}</p>
            <p><strong>Organiza:</strong> {{ event.organizer }}</p>
            <!-- [AGREGADO HU-06] Aforo total explícito -->
            <p><strong>Aforo total:</strong> {{ event.capacity }} personas</p>
          </div>
        </div>

        <aside class="surface booking">
          <small>ENTRADA</small>
          <h2>{{ event.price === 0 ? 'Gratis' : money(event.price, event.currency) }}</h2>
          <p>
            <!-- [AGREGADO HU-06] Muestra estado cancelado, agotado o cupos disponibles vs aforo total -->
            <strong v-if="isCancelled" class="text-negative">Evento cancelado</strong>
            <strong v-else-if="isSoldOut" class="text-grey-8">Evento agotado</strong>
            <span v-else>
              <strong>{{ event.availableSpots }}</strong> de {{ event.capacity }} cupos disponibles
            </span>
          </p>
          <q-linear-progress
            :value="event.capacity > 0 ? Math.max(0, Math.min(1, event.availableSpots / event.capacity)) : 0"
            :color="isSoldOut || isCancelled ? 'grey' : 'primary'"
          />
          <p class="muted" style="margin-top: 8px;">Cupos sujetos a disponibilidad.</p>

          <!-- [AGREGADO HU-06] Botón Comprar entrada (bloqueado si está agotado o cancelado) -->
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="confirmation_number"
            class="full-width booking-cta"
            :label="
              isCancelled
                ? 'Evento cancelado'
                : isSoldOut
                  ? 'Agotado'
                  : 'Comprar entrada'
            "
            :disable="isSoldOut || isCancelled"
            @click="handleBuyAction"
          />

          
        </aside>
      </div>

      <!-- [MEJORADO HU-13] Solo se muestra si el evento finalizó o ya cuenta con reseñas -->
      <section v-if="showReviewsSection" class="surface reviews">
        <h2 class="section-card-title">Lo que cuenta la comunidad</h2>
        <p v-if="summary?.totalReviews">
          <strong>{{ summary.averageRating }} / 5</strong> · {{ summary.totalReviews }} reseñas
        </p>

        <article v-for="item in summary?.reviews || []" :key="item.reviewId" class="review">
          <strong>{{ item.rating }} / 5</strong>
          <p>{{ item.comment || 'Sin comentario' }}</p>
          <small>{{ date(item.createdAt) }}</small>
        </article>

        <p v-if="!summary?.totalReviews">Este evento aún no tiene reseñas.</p>

        <q-form
          v-if="session.user && isFinished"
          class="form-stack"
          @submit="sendReview"
        >
          <h3 style="font-size: 17px; margin: 0;">Comparte tu experiencia</h3>
          <p>
            Sólo se aceptan entradas utilizadas del evento finalizado; el servidor verifica el
            permiso.
          </p>
          <q-input
            v-model="review.ticketId"
            outlined
            label="UUID de tu entrada utilizada"
            hint="Se completa automáticamente si ingresas desde Mis entradas."
            :rules="[required]"
          />
          <q-rating v-model="review.rating" :max="5" color="secondary" />
          <q-input
            v-model="review.comment"
            outlined
            type="textarea"
            label="Tu comentario (opcional)"
            maxlength="1000"
          />
          <q-banner v-if="reviewError" class="error" role="alert">{{ reviewError }}</q-banner>
          <q-banner v-if="reviewSuccess" class="success" role="status">{{ reviewSuccess }}</q-banner>
          <q-btn type="submit" unelevated no-caps color="primary" label="Publicar reseña" />
        </q-form>
      </section>

      <!-- [AGREGADO HU-06 / HU-13] Próximos eventos que podrían interesarte -->
      <section v-if="relatedEvents.length" style="margin-top: 32px;">
        <div class="eyebrow">SIGUE EXPLORANDO</div>
        <h2 class="section-card-title">Próximos eventos que podrían interesarte</h2>
        <div class="event-grid">
          <EventCard
            v-for="(ev, idx) in relatedEvents"
            :key="ev.id"
            :event="ev"
            :index="idx"
          />
        </div>
      </section>
    </template>
  </q-page>
</template>

<style scoped>
/* [AGREGADO] Jerarquía tipográfica equilibrada para títulos de sección y botón de reserva */
.section-card-title {
  font-size: 19px;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 14px;
}

.booking-cta {
  margin-top: 14px;
  border-radius: 999px;
  padding: 10px 20px;
  font-weight: 700;
}
</style>