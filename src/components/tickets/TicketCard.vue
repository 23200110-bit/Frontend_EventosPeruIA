<script setup>
import { computed } from 'vue'
import { date, money } from '@/utils/formatters'
import { getTicketStatusMeta } from '@/utils/ticketHelpers'

const props = defineProps({
  ticket: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  // [AGREGADO] Indica si el usuario ya publicó una reseña activa en este evento
  alreadyReviewed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select'])

const statusMeta = computed(() => getTicketStatusMeta(props.ticket.estado))
const isCanceled = computed(
  () => props.ticket.pendienteReembolso || statusMeta.value.key === 'anulada'
)
// [AGREGADO HU-13] Detecta si la entrada ya fue utilizada
const isUsed = computed(() => statusMeta.value.key === 'utilizada')

// [AGREGADO] Solo habilita reseñas cuando la fecha del evento ya culminó
const isEventFinished = computed(() => {
  const rawEnd = props.ticket.fechaFin || props.ticket.fechaEvento
  if (!rawEnd) return false
  return new Date(rawEnd) < new Date()
})

// [AGREGADO] Solo permite abrir/usar el QR a partir del día programado del evento
const canUseTicketToday = computed(() => {
  const rawStart = props.ticket.fechaEvento
  if (!rawStart) return true
  const eventDate = new Date(rawStart)
  const now = new Date()
  const startOfEventDay = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate()
  )
  return now >= startOfEventDay
})

// [AGREGADO] Estados excluyentes para reseñar o ver la reseña ya publicada
const canWriteReview = computed(
  () => isUsed.value && isEventFinished.value && !props.alreadyReviewed
)
const showAlreadyReviewed = computed(
  () => isUsed.value && isEventFinished.value && props.alreadyReviewed
)
</script>

<template>
  <article class="ticket-card">
    <div class="ticket-card__cover">
      <img
        v-if="ticket.imagenUrl"
        :src="ticket.imagenUrl"
        :alt="ticket.nombreEvento"
        loading="lazy"
      />
      <div v-else class="ticket-card__fallback">
        <q-icon name="confirmation_number" size="34px" color="primary" />
      </div>
    </div>

    <div class="ticket-card__body">
      <div class="ticket-card__top">
        <div>
          <h3 class="ticket-card__title">{{ ticket.nombreEvento }}</h3>
          <div class="ticket-card__meta">
            <span>
              <q-icon name="calendar_today" size="14px" />
              {{ date(ticket.fechaEvento) }}
            </span>
            <span>
              <q-icon name="location_on" size="14px" />
              {{ ticket.ubicacion }}<template v-if="ticket.ciudad"> · {{ ticket.ciudad }}</template>
            </span>
            <span>
              <q-icon name="person" size="14px" />
              Titular: {{ ticket.nombreTitular }} · {{ money(ticket.precio, 'PEN') }}
            </span>
          </div>
        </div>

        <span class="ticket-badge" :class="statusMeta.badgeClass">
          <span class="ticket-badge__dot" />
          {{ ticket.estado || statusMeta.label }}
        </span>
      </div>

      <div v-if="isCanceled" class="ticket-card__alert">
        <q-icon name="info" size="16px" />
        <span>
          <strong>{{ ticket.pendienteReembolso ? 'Pendiente de reembolso' : 'Entrada anulada' }}</strong>
          <template v-if="ticket.motivoCancelacion"> · {{ ticket.motivoCancelacion }}</template>
        </span>
      </div>

      <div class="ticket-card__bottom">
        <span class="ticket-code">{{ ticket.codigoCorto }}</span>

        <div class="ticket-card__actions">
          <router-link :to="'/evento/' + ticket.eventoId">Ver evento</router-link>

          <!-- [AGREGADO HU-13] Solo si el evento culminó, la entrada fue utilizada y aún no reseñó -->
          <q-btn
            v-if="canWriteReview"
            unelevated
            no-caps
            icon="star_rate"
            label="Reseñar evento"
            class="ticket-card__review-btn"
            :to="{
              path: '/resenar/' + ticket.eventoId,
              query: { ticketId: ticket.entradaId }
            }"
          />

          <!-- [AGREGADO HU-13] Si ya reseñó el evento, muestra confirmación y permite ver su reseña -->
          <q-btn
            v-else-if="showAlreadyReviewed"
            unelevated
            no-caps
            icon="check_circle"
            label="Ya reseñaste · Ver reseña"
            class="ticket-card__reviewed-btn"
            :to="{
              path: '/evento/' + ticket.eventoId,
              hash: '#resenas'
            }"
          />

          <!-- [MODIFICADO] Solo permite abrir/usar el QR en la fecha del evento -->
          <span style="display: inline-block;">
            <q-btn
              unelevated
              no-caps
              icon="qr_code_2"
              :label="canUseTicketToday ? 'Ver entrada' : 'Disponible el día del evento'"
              class="ticket-card__btn"
              :loading="loading"
              :disable="!canUseTicketToday || isCanceled"
              @click="emit('select', ticket)"
            />
            <q-tooltip v-if="!canUseTicketToday && !isCanceled">
              Podrás abrir y usar tu entrada QR a partir del {{ date(ticket.fechaEvento) }}.
            </q-tooltip>
          </span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.ticket-card {
  display: flex;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.ticket-card:hover {
  transform: translateY(-2px);
  border-color: var(--brand);
  box-shadow: 0 12px 26px color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.ticket-card__cover {
  width: 215px;
  min-height: 170px;
  flex-shrink: 0;
  background: var(--bg-tertiary);
}

.ticket-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ticket-card__fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background: var(--wash);
}

.ticket-card__body {
  flex: 1;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
}

.ticket-card__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.ticket-card__title {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--ink);
  margin: 0 0 8px;
}

.ticket-card__meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  color: var(--muted-ink);
}

.ticket-card__meta span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ticket-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.ticket-badge__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.ticket-badge--valid {
  background: color-mix(in srgb, var(--success) 15%, transparent);
  color: color-mix(in srgb, var(--success) 50%, var(--text-primary));
}

.ticket-badge--used {
  background: color-mix(in srgb, var(--text-secondary) 10%, transparent);
  color: var(--text-secondary);
}

.ticket-badge--canceled {
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  color: color-mix(in srgb, var(--danger) 50%, var(--text-primary));
}

.ticket-card__alert {
  display: flex;
  align-items: center;
  gap: 8px;
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  color: color-mix(in srgb, var(--danger) 50%, var(--text-primary));
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12.5px;
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
}

.ticket-card__bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-top: 4px;
  flex-wrap: wrap;
}

.ticket-code {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  font-family: monospace;
}

.ticket-card__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  font-weight: 700;
  flex-wrap: wrap;
}

.ticket-card__btn {
  background: color-mix(in srgb, var(--brand) 15%, transparent);
  color: var(--brand);
  border-radius: 999px;
  padding: 6px 16px;
  font-weight: 700;
  transition: all 0.2s ease;
}

.ticket-card__btn:hover {
  background: color-mix(in srgb, var(--brand) 25%, transparent);
}

.ticket-card__review-btn {
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  color: color-mix(in srgb, var(--warning) 50%, var(--text-primary));
  border-radius: 999px;
  padding: 6px 16px;
  font-weight: 700;
  transition: all 0.2s ease;
}

.ticket-card__review-btn:hover {
  background: color-mix(in srgb, var(--warning) 25%, transparent);
}

/* [AGREGADO HU-13] Estilo de insignia/botón cuando ya reseñaste */
.ticket-card__reviewed-btn {
  background: #e1f7ea;
  color: #157a44;
  border-radius: 999px;
  padding: 6px 16px;
  font-weight: 700;
}

@media (max-width: 640px) {
  .ticket-card {
    flex-direction: column;
  }

  .ticket-card__cover {
    width: 100%;
    height: 155px;
  }
}
</style>