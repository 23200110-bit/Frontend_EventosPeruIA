<script setup>
import { computed, ref } from 'vue'
import { date, money } from '@/utils/formatters'

const props = defineProps({
  event: { type: Object, required: true }
})

const emit = defineEmits(['view', 'edit', 'attendees', 'cancel'])

const imgFailed = ref(false)
const soldCount = computed(() => Number(props.event.ticketsVendidos ?? 0))
const totalCapacity = computed(() => Number(props.event.aforo ?? 0))
const progressRatio = computed(() =>
  totalCapacity.value > 0 ? Math.min(soldCount.value / totalCapacity.value, 1) : 0
)
// Ingreso real cobrado (suma de lo pagado por cada entrada); no cambia al editar el precio.
const estimatedRevenue = computed(() => Number(props.event.ingresosTotales ?? 0))

const isPendingReview = computed(() => {
  const st = (props.event.estado || '').toLowerCase()
  const mod = (props.event.estadoModeracion || '').toLowerCase()
  return st.includes('public') && mod === 'pendienterevision'
})

const displayStatus = computed(() => {
  if (isPendingReview.value) return 'Pendiente de revisión'
  return props.event.estado || 'Borrador'
})

const statusColor = computed(() => {
  if (isPendingReview.value) return 'warning'
  const st = (props.event.estado || '').toLowerCase()
  if (st.includes('public')) return 'positive'
  if (st.includes('borrador')) return 'grey-7'
  if (st.includes('cancel')) return 'negative'
  if (st.includes('final')) return 'info'
  return 'primary'
})

const canEdit = computed(() => {
  const st = (props.event.estado || '').toLowerCase()
  return !st.includes('cancel') && !st.includes('final')
})

const canCancel = computed(() => {
  const st = (props.event.estado || '').toLowerCase()
  return st.includes('borrador') || st.includes('public')
})
</script>

<template>
  <article class="surface" style="border-radius: 18px; padding: 20px;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
      <!-- Información principal -->
      <div style="display: flex; gap: 16px; align-items: center; flex: 1; min-width: 260px;">
        <img
          v-if="event.imagenUrl && !imgFailed"
          :src="event.imagenUrl"
          :alt="event.nombre"
          style="width: 96px; height: 72px; object-fit: cover; border-radius: 12px; flex-shrink: 0;"
          @error="imgFailed = true"
        />
        <div
          v-else
          style="width: 96px; height: 72px; border-radius: 12px; background: #eef2ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"
        >
          <q-icon name="event" size="32px" />
        </div>

        <div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <h3 style="margin: 0; font-size: 1.15rem;">{{ event.nombre }}</h3>
            <q-badge
              :color="statusColor"
              :text-color="isPendingReview ? 'dark' : 'white'"
              rounded
              style="padding: 4px 10px; font-weight: 600;"
            >
              {{ displayStatus }}
            </q-badge>
          </div>
          <p class="muted" style="margin: 4px 0 0;">
            {{ event.categoria?.nombre || 'General' }} · {{ date(event.fechaInicio) }} · {{ event.ciudad }}
          </p>
        </div>
      </div>

      <!-- Ingresos y botones de acción -->
      <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
        <div style="text-align: right;">
          <div class="muted" style="font-size: 0.78rem;">Ingresos</div>
          <strong style="font-size: 1.05rem;">{{ money(estimatedRevenue) }}</strong>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <q-btn
            round
            outline
            size="sm"
            color="grey-7"
            icon="visibility"
            aria-label="Ver detalle público"
            @click="emit('view', event)"
          >
            <q-tooltip>Ver evento</q-tooltip>
          </q-btn>

          <q-btn
            v-if="canEdit"
            round
            outline
            size="sm"
            color="primary"
            icon="edit"
            aria-label="Editar evento"
            @click="emit('edit', event)"
          >
            <q-tooltip>Editar evento</q-tooltip>
          </q-btn>

          <q-btn
            round
            outline
            size="sm"
            color="grey-8"
            icon="group"
            aria-label="Asistentes y Check-in"
            @click="emit('attendees', event)"
          >
            <q-tooltip>Asistentes / Check-in</q-tooltip>
          </q-btn>

          <q-btn
            v-if="canCancel"
            outline
            rounded
            no-caps
            size="sm"
            color="negative"
            icon="cancel"
            label="Cancelar evento"
            style="padding: 4px 12px; font-weight: 600;"
            @click="emit('cancel', event)"
          />
        </div>
      </div>
    </div>

    <!-- Barra de progreso de cupos -->
    <div style="margin-top: 16px;">
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;">
        <span><strong>{{ soldCount }}</strong> vendidas</span>
        <span class="muted">{{ totalCapacity }} aforo total</span>
      </div>
      <q-linear-progress
        :value="progressRatio"
        rounded
        size="8px"
        color="primary"
        track-color="grey-3"
      />
    </div>
  </article>
</template>