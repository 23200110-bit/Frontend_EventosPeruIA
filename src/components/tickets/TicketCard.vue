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
  }
})

const emit = defineEmits(['select'])

const statusMeta = computed(() => getTicketStatusMeta(props.ticket.estado))
const isCanceled = computed(
  () => props.ticket.pendienteReembolso || statusMeta.value.key === 'anulada'
)
// [AGREGADO HU-13] Detecta si la entrada ya fue utilizada para habilitar la reseña
const isUsed = computed(() => statusMeta.value.key === 'utilizada')
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

          <!-- [AGREGADO HU-13] Botón directo para reseñar cuando la entrada está Utilizada -->
          <q-btn
            v-if="isUsed"
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

          <q-btn
            unelevated
            no-caps
            icon="qr_code_2"
            label="Ver entrada"
            class="ticket-card__btn"
            :loading="loading"
            @click="emit('select', ticket)"
          />
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.ticket-card {
  display: flex;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 18px;
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.ticket-card:hover {
  transform: translateY(-2px);
  border-color: #cfc1ed;
  box-shadow: 0 12px 26px #231b3c12;
}

.ticket-card__cover {
  width: 215px;
  min-height: 170px;
  flex-shrink: 0;
  background: #ede4ff;
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
  background: #e1f7ea;
  color: #157a44;
}

.ticket-badge--used {
  background: var(--wash);
  color: var(--muted-ink);
}

.ticket-badge--canceled {
  background: #f9e5e1;
  color: #8e2f20;
}

.ticket-card__alert {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f9e5e1;
  color: #8e2f20;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12.5px;
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
  background: var(--wash);
  color: var(--ink);
  border: 1px solid var(--line);
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
  background: var(--wash);
  color: var(--brand);
  border-radius: 999px;
  padding: 6px 16px;
  font-weight: 700;
}

/* [AGREGADO HU-13] Estilo del botón Reseñar evento */
.ticket-card__review-btn {
  background: #fff4d6;
  color: #8a5a00;
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
