<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { eventService } from '@/services/eventService'
import { session } from '@/stores/authStore'
import { date, money } from '@/utils/formatters'
import { required } from '@/utils/validators'

const route = useRoute()
const event = ref(null)
const summary = ref(null)
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

async function refresh() {
  try {
    event.value = await eventService.getEventById(route.params.id)
  } catch (e) {
    error.value = e.message
  }
}

async function load() {
  busy.value = true
  try {
    const id = route.params.id
    event.value = await eventService.getEventById(id)
    summary.value = await eventService.getEventReviews(id)
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
          <q-badge color="primary">{{ event.status }}</q-badge>
          <p class="detail-description">{{ event.description }}</p>

          <div class="surface">
            <h3>Todo lo que necesitas saber</h3>
            <p><strong>Cuándo:</strong> {{ date(event.startDate) }}</p>
            <p><strong>Dónde:</strong> {{ event.venue }} · {{ event.address }}, {{ event.city }}</p>
            <p><strong>Organiza:</strong> {{ event.organizer }}</p>
          </div>
        </div>

        <aside class="surface booking">
          <small>ENTRADA</small>
          <h2>{{ event.price === 0 ? 'Gratis' : money(event.price, event.currency) }}</h2>
          <p>
            {{
              event.availableSpots > 0 ? event.availableSpots + ' cupos disponibles' : 'Evento agotado'
            }}
          </p>
          <q-linear-progress
            :value="Math.max(0, Math.min(1, event.availableSpots / event.capacity))"
            color="primary"
          />
          <p class="muted">Cupos sujetos a disponibilidad.</p>
        </aside>
      </div>

      <section class="surface reviews">
        <h2>Lo que cuenta la comunidad</h2>
        <p v-if="summary?.totalReviews">
          {{ summary.averageRating }} / 5 · {{ summary.totalReviews }} reseñas
        </p>

        <article v-for="item in summary?.reviews || []" :key="item.reviewId" class="review">
          <strong>{{ item.rating }} / 5</strong>
          <p>{{ item.comment || 'Sin comentario' }}</p>
          <small>{{ date(item.createdAt) }}</small>
        </article>

        <p v-if="!summary?.totalReviews">Este evento aún no tiene reseñas.</p>

        <q-form
          v-if="
            session.user &&
            (event.status === 'Finalizado' || new Date(event.endDate || event.startDate) < new Date())
          "
          class="form-stack"
          @submit="sendReview"
        >
          <h3>Comparte tu experiencia</h3>
          <p>
            Sólo se aceptan entradas utilizadas del evento finalizado; el servidor verifica el
            permiso.
          </p>
          <q-input
            v-model="review.ticketId"
            outlined
            label="UUID de tu entrada utilizada"
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
    </template>
  </q-page>
</template>