<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { eventService } from '@/services/eventService'
import { money } from '@/utils/formatters'
import OrganizerEventCard from '@/components/organizer/OrganizerEventCard.vue'
import CancelEventDialog from '@/components/organizer/CancelEventDialog.vue'

const router = useRouter()
const events = ref([])
const busy = ref(true)
const error = ref('')
const successBanner = ref('')
const searchQuery = ref('')
const activeTab = ref('Todos')

const cancelDialogOpen = ref(false)
const eventToCancel = ref(null)

const TABS = [
  'Todos',
  'Borrador',
  'Pendiente de revisión',
  'Publicado',
  'Finalizado',
  'Cancelado'
]

function isPendingReview(ev) {
  const st = (ev.estado || '').toLowerCase()
  const mod = (ev.estadoModeracion || '').toLowerCase()
  return st.includes('public') && mod === 'pendienterevision'
}

const kpis = computed(() => {
  const total = events.value.length
  const published = events.value.filter(
    (e) => (e.estado || '').toLowerCase().includes('public') && !isPendingReview(e)
  ).length
  const ticketsSold = events.value.reduce(
    (acc, e) => acc + Number(e.ticketsVendidos ?? 0),
    0
  )
  const revenue = events.value.reduce(
    (acc, e) => acc + Number(e.ticketsVendidos ?? 0) * Number(e.precio ?? 0),
    0
  )
  return { total, published, ticketsSold, revenue }
})

const tabCounts = computed(() => ({
  Todos: events.value.length,
  Borrador: events.value.filter((e) => (e.estado || '').toLowerCase().includes('borrador')).length,
  'Pendiente de revisión': events.value.filter((e) => isPendingReview(e)).length,
  Publicado: events.value.filter(
    (e) => (e.estado || '').toLowerCase().includes('public') && !isPendingReview(e)
  ).length,
  Finalizado: events.value.filter((e) => (e.estado || '').toLowerCase().includes('final')).length,
  Cancelado: events.value.filter((e) => (e.estado || '').toLowerCase().includes('cancel')).length
}))

const filteredEvents = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return events.value.filter((ev) => {
    const matchesText =
      !q ||
      (ev.nombre || '').toLowerCase().includes(q) ||
      (ev.ciudad || '').toLowerCase().includes(q)

    const st = (ev.estado || '').toLowerCase()
    const pending = isPendingReview(ev)

    const matchesTab =
      activeTab.value === 'Todos' ||
      (activeTab.value === 'Borrador' && st.includes('borrador')) ||
      (activeTab.value === 'Pendiente de revisión' && pending) ||
      (activeTab.value === 'Publicado' && st.includes('public') && !pending) ||
      (activeTab.value === 'Finalizado' && st.includes('final')) ||
      (activeTab.value === 'Cancelado' && st.includes('cancel'))

    return matchesText && matchesTab
  })
})

function openCancelModal(ev) {
  eventToCancel.value = ev
  cancelDialogOpen.value = true
}

async function handleEventCanceled() {
  successBanner.value = 'El evento ha sido cancelado correctamente y se notificó a los asistentes afectados.'
  await loadMyEvents()
}

async function loadMyEvents() {
  busy.value = true
  error.value = ''
  try {
    const list = await eventService.getMyEvents()
    events.value = Array.isArray(list) ? list : list?.items || []
  } catch (e) {
    error.value = e.message || 'No se pudieron cargar tus eventos.'
  } finally {
    busy.value = false
  }
}

onMounted(loadMyEvents)
</script>

<template>
  <q-page class="container">
    <!-- Cabecera -->
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 24px;">
      <div>
        <div class="eyebrow">PANEL DE ORGANIZADOR</div>
        <h1 class="page-heading" style="margin-bottom: 4px;">Mis eventos</h1>
        <p class="muted" style="margin: 0;">Gestiona todos tus eventos en un solo lugar</p>
      </div>

      <q-btn
        unelevated
        rounded
        no-caps
        color="primary"
        icon="add"
        label="Crear evento"
        style="padding: 10px 22px; font-weight: 600;"
        @click="router.push('/organizador/crear-evento')"
      />
    </div>

    <!-- 4 Tarjetas KPI -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
      <div class="surface" style="border-radius: 16px; padding: 18px;">
        <q-icon name="festival" color="primary" size="26px" />
        <div class="kpi-value kpi-value--brand">
          {{ kpis.total }}
        </div>
        <div class="muted">Eventos totales</div>
      </div>

      <div class="surface" style="border-radius: 16px; padding: 18px;">
        <q-icon name="check_circle" color="positive" size="26px" />
        <div class="kpi-value kpi-value--success">
          {{ kpis.published }}
        </div>
        <div class="muted">Publicados</div>
      </div>

      <div class="surface" style="border-radius: 16px; padding: 18px;">
        <q-icon name="confirmation_number" color="amber-8" size="26px" />
        <div class="kpi-value kpi-value--warning">
          {{ kpis.ticketsSold }}
        </div>
        <div class="muted">Entradas vendidas</div>
      </div>

      <div class="surface" style="border-radius: 16px; padding: 18px;">
        <q-icon name="payments" color="orange-8" size="26px" />
        <div class="kpi-value kpi-value--warning">
          {{ money(kpis.revenue) }}
        </div>
        <div class="muted">Ingresos totales</div>
      </div>
    </div>

    <!-- Buscador + Pestañas de estado -->
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 20px;">
      <q-input
        v-model="searchQuery"
        outlined
        dense
        rounded
        placeholder="Buscar por nombre o ciudad..."
        style="min-width: 240px; flex: 1; max-width: 340px;"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>

      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        <q-btn
          v-for="tab in TABS"
          :key="tab"
          rounded
          no-caps
          :unelevated="activeTab === tab"
          :flat="activeTab !== tab"
          :color="activeTab === tab ? 'primary' : 'grey-8'"
          :label="`${tab} (${tabCounts[tab]})`"
          @click="activeTab = tab"
        />
      </div>
    </div>

    <q-banner v-if="error" class="error" role="alert" style="margin-bottom: 16px;">
      {{ error }}
    </q-banner>

    <q-banner
      v-if="successBanner"
      rounded
      class="bg-positive text-white"
      style="margin-bottom: 16px;"
    >
      {{ successBanner }}
    </q-banner>

    <div v-if="busy" class="empty">
      <q-spinner color="primary" size="28px" /> Cargando tus eventos...
    </div>

    <div v-else-if="!filteredEvents.length" class="empty">
      No tienes eventos registrados en esta vista. Haz clic en <strong>+ Crear evento</strong> para publicar el primero.
    </div>

    <div v-else style="display: grid; gap: 16px; width: 100%;">
      <OrganizerEventCard
        v-for="ev in filteredEvents"
        :key="ev.eventoId"
        :event="ev"
        @view="(item) => router.push(`/evento/${item.eventoId}`)"
        @edit="(item) => router.push(`/organizador/editar-evento/${item.eventoId}`)"
        @attendees="(item) => router.push({ path: `/organizador/checkin/${item.eventoId}`, query: { name: item.nombre } })"
        @cancel="openCancelModal"
      />
    </div>

    <!-- Modal de Cancelación (US-009) -->
    <CancelEventDialog
      v-model="cancelDialogOpen"
      :event="eventToCancel"
      @canceled="handleEventCanceled"
    />
  </q-page>
</template>

<style scoped>
.kpi-value {
  font-size: 1.7rem;
  font-weight: 700;
  margin-top: 8px;
}

.kpi-value--brand {
  color: var(--brand);
}

.kpi-value--success {
  color: color-mix(in srgb, var(--success) 60%, var(--text-primary));
}

.kpi-value--warning {
  color: color-mix(in srgb, var(--warning) 60%, var(--text-primary));
}
</style>