<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EventCard from '@/components/events/EventCard.vue'
import LoadError from '@/components/common/LoadError.vue'
import { eventService } from '@/services/eventService'
import { ticketService } from '@/services/ticketService'
import { session } from '@/stores/authStore'
import { date, money, shortDate } from '@/utils/formatters'

const route = useRoute()
const router = useRouter()

const event = ref(null)
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
  <q-page class="detail-page" :class="{ 'has-buybar': event && !isClosedForSale }">
    <div v-if="!event" class="container">
      <router-link to="/explorar" class="back-link">← Volver a explorar</router-link>
      <LoadError v-if="error && !busy" :message="error" :busy="busy" @retry="load" />
      <div v-if="busy" class="empty"><q-spinner /> Cargando evento…</div>
    </div>

    <template v-if="event">
      <!-- CABECERA INMERSIVA: imagen a todo el ancho con degradado para leer el texto -->
      <header class="detail-hero" :class="{ 'is-closed': isClosedForSale }">
        <div
          class="detail-hero__bg"
          :style="event.imageUrl ? { backgroundImage: 'url(' + JSON.stringify(event.imageUrl) + ')' } : null"
          aria-hidden="true"
        ></div>
        <div class="detail-hero__shade" aria-hidden="true"></div>
        <div class="detail-hero__content">
          <router-link to="/explorar" class="detail-back">
            <q-icon name="arrow_back" size="18px" aria-hidden="true" /> Explorar
          </router-link>
          <div class="detail-hero__eyebrow">{{ [event.category, event.city].filter(Boolean).join(' · ') }}</div>
          <h1 class="detail-hero__title">{{ event.name }}</h1>
          <p class="detail-hero__meta">
            <span><q-icon name="event" size="18px" aria-hidden="true" /> {{ shortDate(event.startDate) }}</span>
            <span v-if="event.venue || event.address">
              <q-icon name="place" size="18px" aria-hidden="true" /> {{ event.venue || event.address }}
            </span>
          </p>

          <!-- Badges de estado y valoración -->
          <div class="detail-badges">
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
        </div>
      </header>

      <div class="container detail-body">
      <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>
      <div class="detail-top detail-grid">
        <!-- COLUMNA PRINCIPAL IZQUIERDA -->
        <div class="detail-main">
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
              class="full-width booking-cta btn-buy"
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
      </div>

      <!-- BARRA DE COMPRA FIJA EN MÓVIL: precio y botón siempre a mano -->
      <div v-if="!isClosedForSale" class="buybar" role="region" aria-label="Comprar entrada">
        <div class="buybar__price">
          <small>Entrada</small>
          <strong>{{ event.price === 0 ? 'Gratis' : money(event.price, event.currency) }}</strong>
        </div>
        <q-btn
          unelevated
          rounded
          no-caps
          color="primary"
          icon="confirmation_number"
          class="buybar__cta btn-buy"
          :label="isSoldOut ? 'Agotado' : 'Comprar entrada'"
          :disable="isSoldOut"
          @click="handleBuyAction"
        />
      </div>
    </template>
  </q-page>
</template>

<style scoped>
/* Cabecera inmersiva */
.detail-hero {
  position: relative;
  min-height: 380px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  color: #ffffff;
  background: linear-gradient(135deg, #24156b 0%, #5038b9 55%, #a8327a 100%);
}

.detail-hero__bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}

.detail-hero.is-closed .detail-hero__bg {
  filter: grayscale(0.6);
}

.detail-hero__shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(10, 8, 20, 0.3) 0%, rgba(10, 8, 20, 0.55) 50%, rgba(10, 8, 20, 0.92) 100%);
}

.detail-hero__content {
  position: relative;
  width: 100%;
  max-width: 1190px;
  margin: 0 auto;
  padding: 84px 24px 30px;
}

.detail-back {
  position: absolute;
  top: 22px;
  left: 24px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(10, 8, 20, 0.45);
  backdrop-filter: blur(8px);
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}

.detail-back:hover,
.detail-back:focus-visible {
  background: rgba(10, 8, 20, 0.7);
}

.detail-hero__eyebrow {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.88);
}

.detail-hero__title {
  margin: 8px 0 12px;
  max-width: 900px;
  font-size: clamp(32px, 5.2vw, 56px);
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #ffffff;
}

.detail-hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin: 0 0 14px;
  font-size: 16px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.94);
}

.detail-hero__meta span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.detail-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-body {
  padding-top: 8px;
}

.detail-body .detail-top {
  margin-top: 20px;
}

.detail-description {
  margin: 0;
  font-size: 16.5px;
  line-height: 1.75;
  color: var(--text-primary);
}

/* Barra de compra fija sólo en móvil */
.buybar {
  display: none;
}

@media (max-width: 767px) {
  .detail-hero {
    min-height: 320px;
  }
  .detail-hero__content {
    padding: 76px 16px 22px;
  }
  .detail-back {
    left: 16px;
    top: 16px;
  }
  .detail-page.has-buybar {
    padding-bottom: calc(92px + env(safe-area-inset-bottom, 0px));
  }
  .buybar {
    display: flex;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 60;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
    background: var(--bg-primary);
    border-top: 1px solid var(--border-color);
    box-shadow: 0 -10px 24px -14px rgba(0, 0, 0, 0.4);
  }
  .buybar__price {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
  }
  .buybar__price small {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }
  .buybar__price strong {
    font-size: 20px;
    font-weight: 900;
    color: var(--text-primary);
  }
  .buybar__cta {
    min-height: 48px;
    padding: 0 22px;
    font-weight: 800;
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
  color: var(--text-primary);
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
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.archive-cancelled {
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.35);
  color: #dc2626;
}

.archive-stat-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
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
  border-bottom: 1px solid var(--border-color);
}

.rating-summary-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  padding: 10px 16px;
  border-radius: 14px;
}

.rating-big {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary);
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
  color: var(--border-color);
}

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.review-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
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
  background: rgba(124, 92, 245, 0.16);
  color: var(--brand);
  display: flex;
  align-items: center;
  justify-content: center;
}

.review-author__name {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
}

.review-card__body {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.5;
  color: var(--text-primary);
}

.reviewed-banner {
  margin-top: 20px;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(18, 163, 114, 0.12);
  border: 1px solid rgba(18, 163, 114, 0.35);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 12px;
}

.review-composer {
  margin-top: 20px;
  padding: 20px;
  border-radius: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
}

.review-composer__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>