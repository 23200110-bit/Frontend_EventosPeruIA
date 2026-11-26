<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EventCard from '@/components/events/EventCard.vue'
import { eventService } from '@/services/eventService'
import { ticketService } from '@/services/ticketService'
import { session } from '@/stores/authStore'
import { date, money } from '@/utils/formatters'

const route = useRoute()
const router = useRouter()

const event = ref(null)
const backdropReady = ref(false)

watch(() => event.value?.imageUrl, () => {
  backdropReady.value = false
})
const summary = ref(null)
const relatedEvents = ref([])
const busy = ref(true)
const submittingReview = ref(false)
const error = ref('')
const reviewError = ref('')
const hasSubmittedReview = ref(false)
const reviewSectionRef = ref(null)

let timer = null

const review = reactive({
  ticketId: '',
  rating: 5,
  comment: ''
})

// Estados computados del evento (HU-06 / HU-13)
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

const isClosedForSale = computed(() => isFinished.value || isCancelled.value)

// Detecta si el usuario actual ya tiene una reseña activa en este evento
const currentUserId = computed(() => Number(session.user?.userId || session.user?.id || 0))

const userAlreadyReviewed = computed(() => {
  if (hasSubmittedReview.value) return true
  if (!currentUserId.value || !summary.value?.reviews?.length) return false
  return summary.value.reviews.some((r) => Number(r.userId) === currentUserId.value)
})

// Solo muestra el formulario si: inició sesión + evento finalizado + tiene entrada utilizada + aún no reseñó
const canWriteReview = computed(
  () =>
    Boolean(session.user) &&
    isFinished.value &&
    Boolean(review.ticketId) &&
    !userAlreadyReviewed.value
)

// Solo muestra la sección de reseñas si el evento ya finalizó o ya tiene reseñas publicadas
const showReviewsSection = computed(
  () => isFinished.value || (summary.value?.totalReviews ?? 0) > 0
)

function scrollToReviewForm() {
  reviewSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function refresh() {
  if (isClosedForSale.value) return
  try {
    event.value = await eventService.getEventById(route.params.id)
  } catch (e) {
    error.value = e.message
  }
}

// Detecta automáticamente en segundo plano la entrada 'Utilizada' sin mostrar UUIDs al usuario
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
    // Si no tiene entradas utilizadas, review.ticketId queda vacío y oculta el formulario
  }
}

// Carga hasta 3 próximos eventos excluyendo el actual
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
  hasSubmittedReview.value = false
  review.ticketId = ''
  review.comment = ''
  review.rating = 5

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
  if (!review.ticketId || userAlreadyReviewed.value) return
  reviewError.value = ''
  submittingReview.value = true
  try {
    const id = route.params.id
    await eventService.createReview(id, review)
    hasSubmittedReview.value = true
    summary.value = await eventService.getEventReviews(id)
    review.comment = ''
  } catch (e) {
    reviewError.value = e.message
  } finally {
    submittingReview.value = false
  }
}

function handleBuyAction() {
  if (isSoldOut.value || isClosedForSale.value) return
  if (!session.user) {
    router.push({ path: '/login', query: { next: `/evento/${event.value.id}/comprar` } })
    return
  }
  router.push(`/evento/${event.value.id}/comprar`)
}

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
  <q-page class="event-detail-page">
    <div
      v-if="event?.imageUrl"
      :key="event.imageUrl"
      class="event-detail-backdrop"
      :class="{ 'is-ready': backdropReady }"
      aria-hidden="true"
    >
      <img
        :src="event.imageUrl"
        alt=""
        @load="backdropReady = true"
        @error="backdropReady = false"
      />
    </div>

    <div class="container event-detail-content">
      <router-link to="/explorar" class="back-link">← Volver a explorar</router-link>

      <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>
      <div v-if="busy" class="empty"><q-spinner /> Cargando evento…</div>

      <template v-if="event">
        <div class="detail-top detail-grid">
          <!-- COLUMNA PRINCIPAL IZQUIERDA -->
          <div class="detail-main">
            <div class="eyebrow">{{ event.category }} · {{ event.city }}</div>
            <h1 class="page-heading">{{ event.name }}</h1>

            <!-- Badges de estado y valoración -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;">
              <q-badge
                :color="isCancelled ? 'negative' : isFinished ? 'grey-8' : 'primary'"
                style="padding: 5px 10px; font-weight: 700;"
              >
                {{ isCancelled ? 'Cancelado' : isFinished ? 'Finalizado' : event.status }}
              </q-badge>
              <q-badge
                v-if="isSoldOut && !isClosedForSale"
                color="grey-8"
                style="padding: 5px 10px; font-weight: 700;"
              >
                Agotado
              </q-badge>
              <q-badge
                v-if="summary?.totalReviews"
                color="amber-8"
                text-color="black"
                style="padding: 5px 10px; font-weight: 700;"
              >
                ★ {{ Number(summary.averageRating).toFixed(1) }} ({{ summary.totalReviews }})
              </q-badge>
            </div>

            <p class="detail-description">{{ event.description }}</p>

            <!-- Ficha técnica del evento -->
            <div class="surface info-card">
              <h2 class="section-card-title">Detalle sobre este evento</h2>
              <div class="info-list">
                <div class="info-row">
                  <q-icon name="event" size="20px" color="primary" />
                  <div>
                    <small class="muted">Fecha y hora</small>
                    <div><strong>{{ date(event.startDate) }}</strong></div>
                  </div>
                </div>
                <div class="info-row">
                  <q-icon name="place" size="20px" color="primary" />
                  <div>
                    <small class="muted">Ubicación</small>
                    <div>
                      <strong>{{ event.venue }}</strong> · {{ event.address }}, {{ event.city }}
                    </div>
                  </div>
                </div>
                <div class="info-row">
                  <q-icon name="person_pin" size="20px" color="primary" />
                  <div>
                    <small class="muted">Organizador</small>
                    <div><strong>{{ event.organizer }}</strong></div>
                  </div>
                </div>
                <div class="info-row">
                  <q-icon name="groups" size="20px" color="primary" />
                  <div>
                    <small class="muted">Aforo del recinto</small>
                    <div><strong>{{ event.capacity }} personas</strong></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- SECCIÓN DE RESEÑAS INTEGRADA EN LA COLUMNA PRINCIPAL (HU-13) -->
            <section
              v-if="showReviewsSection"
              ref="reviewSectionRef"
              class="surface reviews-section"
            >
              <div class="reviews-header">
                <div>
                  <div class="eyebrow">OPINIONES VERIFICADAS</div>
                  <h2 class="section-card-title" style="margin-bottom: 4px;">
                    Lo que cuenta la comunidad
                  </h2>
                </div>

                <div v-if="summary?.totalReviews" class="rating-summary-pill">
                  <span class="rating-big">{{ Number(summary.averageRating).toFixed(1) }}</span>
                  <div>
                    <div class="stars-row" aria-label="Calificación promedio">
                      <span
                        v-for="n in 5"
                        :key="n"
                        :class="n <= Math.round(summary.averageRating) ? 'star-on' : 'star-off'"
                      >
                        ★
                      </span>
                    </div>
                    <small class="muted">
                      {{ summary.totalReviews }}
                      {{ summary.totalReviews === 1 ? 'reseña' : 'reseñas' }}
                    </small>
                  </div>
                </div>
              </div>

              <!-- Lista de reseñas -->
              <div v-if="summary?.reviews?.length" class="reviews-list">
                <article
                  v-for="item in summary.reviews"
                  :key="item.reviewId"
                  class="review-card"
                >
                  <div class="review-card__top">
                    <div class="review-author">
                      <div class="review-avatar">
                        <q-icon name="person" size="18px" />
                      </div>
                      <div>
                        <div class="review-author__name">
                          {{
                            Number(item.userId) === currentUserId
                              ? 'Tu reseña verificada'
                              : 'Asistente verificado'
                          }}
                        </div>
                        <small class="muted">{{ date(item.createdAt) }}</small>
                      </div>
                    </div>

                    <div class="review-stars">
                      <span
                        v-for="n in 5"
                        :key="n"
                        :class="n <= item.rating ? 'star-on' : 'star-off'"
                      >
                        ★
                      </span>
                    </div>
                  </div>

                  <p class="review-card__body">
                    {{ item.comment || 'Calificación sin comentario adicional.' }}
                  </p>
                </article>
              </div>

              <p v-else class="muted" style="margin: 14px 0 4px;">
                Aún no hay reseñas publicadas para este evento.
              </p>

              <!-- Ya reseñó: oculta el formulario y confirma -->
              <div v-if="session.user && isFinished && userAlreadyReviewed" class="reviewed-banner">
                <q-icon name="check_circle" color="positive" size="24px" />
                <div>
                  <strong>Ya compartiste tu experiencia sobre este evento</strong>
                  <p class="muted" style="margin: 2px 0 0; font-size: 13.5px;">
                    Solo se permite una reseña activa por asistente. ¡Gracias por aportar a la comunidad!
                  </p>
                </div>
              </div>

              <!-- Puede reseñar: formulario limpio sin campo UUID -->
              <q-form
                v-else-if="canWriteReview"
                class="review-composer"
                @submit.prevent="sendReview"
              >
                <div class="review-composer__head">
                  <h3 style="font-size: 17px; font-weight: 700; margin: 0;">Comparte tu experiencia</h3>
                  <q-badge color="positive" outline label="Asistencia verificada" />
                </div>
                <p class="muted" style="margin: 4px 0 12px; font-size: 13.5px;">
                  Tu opinión ayuda a otros usuarios a decidir a qué eventos asistir.
                </p>

                <div style="margin-bottom: 12px;">
                  <small class="muted" style="display: block; margin-bottom: 4px;">
                    ¿Qué te pareció el evento?
                  </small>
                  <q-rating
                    v-model="review.rating"
                    :max="5"
                    size="32px"
                    color="amber-7"
                    icon="star_border"
                    icon-selected="star"
                  />
                </div>

                <q-input
                  v-model="review.comment"
                  outlined
                  type="textarea"
                  rows="3"
                  bg-color="white"
                  label="Cuéntanos qué fue lo que más te gustó (opcional)"
                  maxlength="1000"
                  counter
                />

                <q-banner v-if="reviewError" class="error" role="alert" style="margin-top: 10px;">
                  {{ reviewError }}
                </q-banner>

                <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
                  <q-btn
                    type="submit"
                    unelevated
                    no-caps
                    color="primary"
                    icon="send"
                    label="Publicar reseña"
                    :loading="submittingReview"
                    style="border-radius: 999px; padding: 8px 22px; font-weight: 700;"
                  />
                </div>
              </q-form>

              <!-- Logueado pero sin entrada utilizada -->
              <div
                v-else-if="session.user && isFinished && !review.ticketId"
                class="muted"
                style="margin-top: 16px; font-size: 13.5px;"
              >
                Solo los asistentes que validaron su entrada en puerta pueden dejar una reseña.
              </div>
            </section>
          </div>

          <!-- COLUMNA DERECHA (ASIDE INTELIGENTE SEGÚN ESTADO DEL EVENTO) -->
          <aside class="surface booking booking-sticky">
            <!-- CASO A: Evento Finalizado o Cancelado -> Tarjeta de resumen histórico (sin precio ni compra) -->
            <template v-if="isClosedForSale">
              <div class="archive-badge" :class="isCancelled ? 'archive-cancelled' : 'archive-finished'">
                <q-icon :name="isCancelled ? 'event_busy' : 'event_available'" size="20px" />
                <span>{{ isCancelled ? 'EVENTO CANCELADO' : 'EDICIÓN FINALIZADA' }}</span>
              </div>

              <h3 style="font-size: 20px; font-weight: 800; margin: 14px 0 6px; line-height: 1.25;">
                {{
                  isCancelled
                    ? 'Este evento fue cancelado por el organizador'
                    : 'Este evento ya concluyó'
                }}
              </h3>

              <p class="muted" style="font-size: 14px; line-height: 1.5; margin-bottom: 16px;">
                {{
                  isCancelled
                    ? 'La venta de entradas se encuentra cerrada. Revisa tus entradas si adquiriste un ticket para este evento.'
                    : 'La venta de entradas está cerrada. Revisa las experiencias de los asistentes o descubre próximas fechas.'
                }}
              </p>

              <div v-if="isFinished && summary?.totalReviews" class="archive-stat-box">
                <div>
                  <small class="muted">Valoración del público</small>
                  <div style="font-size: 18px; font-weight: 800;">
                    ★ {{ Number(summary.averageRating).toFixed(1) }} / 5.0
                  </div>
                </div>
                <q-badge color="amber-8" text-color="black">
                  {{ summary.totalReviews }} {{ summary.totalReviews === 1 ? 'opinión' : 'opiniones' }}
                </q-badge>
              </div>

              <q-btn
                v-if="canWriteReview"
                unelevated
                no-caps
                color="primary"
                icon="rate_review"
                label="Calificar mi asistencia"
                class="full-width booking-cta"
                @click="scrollToReviewForm"
              />

              <q-btn
                unelevated
                no-caps
                :outline="canWriteReview"
                color="primary"
                icon="explore"
                label="Explorar próximos eventos"
                class="full-width booking-cta"
                to="/explorar"
              />
            </template>

            <!-- CASO B: Evento Activo / Próximo -> Panel de venta de entradas -->
            <template v-else>
              <small>ENTRADA</small>
              <h2>{{ event.price === 0 ? 'Gratis' : money(event.price, event.currency) }}</h2>
              <p>
                <strong v-if="isSoldOut" class="text-grey-8">Evento agotado</strong>
                <span v-else>
                  <strong>{{ event.availableSpots }}</strong> de {{ event.capacity }} cupos disponibles
                </span>
              </p>
              <q-linear-progress
                :value="event.capacity > 0 ? Math.max(0, Math.min(1, event.availableSpots / event.capacity)) : 0"
                :color="isSoldOut ? 'grey' : 'primary'"
              />
              <p class="muted" style="margin-top: 8px;">Cupos sujetos a disponibilidad.</p>

              <q-btn
                unelevated
                no-caps
                color="primary"
                icon="confirmation_number"
                class="full-width booking-cta"
                :label="isSoldOut ? 'Agotado' : 'Comprar entrada'"
                :disable="isSoldOut"
                @click="handleBuyAction"
              />
            </template>
          </aside>
        </div>

        <!-- Próximos eventos que podrían interesarte -->
        <section v-if="relatedEvents.length" style="margin-top: 40px;">
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
    </div>
  </q-page>
</template>

<style scoped>
.event-detail-page {
  position: relative;
  isolation: isolate;
}

.event-detail-content > .back-link {
  color: #cfe0ff;
}

.event-detail-backdrop {
  position: absolute;
  inset: 0 0 auto;
  z-index: -1;
  height: clamp(470px, 40vw, 640px);
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(105deg, #071630 10%, #112752 62%, #182d59);
  mask-image: linear-gradient(to bottom, #000 64%, transparent 100%);
}

.event-detail-backdrop.is-ready {
  opacity: 1;
}

.event-detail-backdrop img {
  position: absolute;
  top: 0;
  right: max(0px, calc((100% - 820px) / 2));
  display: block;
  width: auto;
  max-width: 76%;
  height: 100%;
  object-fit: contain;
  object-position: right top;
  opacity: 0.72;
  filter: blur(2px);
  mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent);
}

.event-detail-backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    #071630 4%,
    rgba(7, 22, 48, 0.95) 30%,
    rgba(7, 22, 48, 0.78) 48%,
    rgba(7, 22, 48, 0.24) 73%,
    rgba(7, 22, 48, 0.12) 100%
  );
}

@media (max-width: 700px) {
  .event-detail-backdrop {
    height: 540px;
  }

  .event-detail-backdrop img {
    right: 0;
    width: 100%;
    max-width: 100%;
    object-position: center top;
    opacity: 0.45;
  }

  .event-detail-backdrop::after {
    background: linear-gradient(
      180deg,
      rgba(7, 22, 48, 0.55),
      rgba(7, 22, 48, 0.85) 72%,
      #071630
    );
  }
}
.detail-grid {
  align-items: start;
}

.detail-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.booking-sticky {
  position: sticky;
  top: 88px;
}

.section-card-title {
  font-size: 19px;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 14px;
}

.info-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.booking-cta {
  margin-top: 12px;
  border-radius: 999px;
  padding: 10px 20px;
  font-weight: 700;
}

/* Tarjeta de archivo cuando el evento ya finalizó o fue cancelado */
.archive-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  padding: 6px 12px;
  border-radius: 999px;
}

.archive-finished {
  background: #f1f5f9;
  color: #334155;
}

.archive-cancelled {
  background: #fef2f2;
  color: #b91c1c;
}

.archive-stat-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 6px;
}

/* Estilos modernos para reseñas */
.reviews-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line, #e5e7eb);
}

.rating-summary-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 10px 16px;
  border-radius: 14px;
}

.rating-big {
  font-size: 28px;
  font-weight: 800;
  color: var(--ink, #111827);
  line-height: 1;
}

.stars-row,
.review-stars {
  display: flex;
  gap: 2px;
  font-size: 16px;
  line-height: 1;
}

.star-on {
  color: #f59e0b;
}

.star-off {
  color: #cbd5e1;
}

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.review-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 16px;
}

.review-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.review-author {
  display: flex;
  align-items: center;
  gap: 10px;
}

.review-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #ede9fe;
  color: #5b21b6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.review-author__name {
  font-weight: 700;
  font-size: 14px;
  color: var(--ink, #111827);
}

.review-card__body {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.5;
  color: #334155;
}

.reviewed-banner {
  margin-top: 20px;
  padding: 14px 18px;
  border-radius: 14px;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  color: #14532d;
  display: flex;
  align-items: center;
  gap: 12px;
}

.review-composer {
  margin-top: 20px;
  padding: 20px;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.review-composer__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
