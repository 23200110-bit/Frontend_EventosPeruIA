<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { eventService } from '@/services/eventService'
import { date } from '@/utils/formatters'

const route = useRoute()
const router = useRouter()

const events = ref([])
const selectedId = ref(null)
const loadingEvents = ref(true)
const eventsError = ref('')

const summary = ref(null)
const rows = ref([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const status = ref('')
const pagination = ref({ page: 1, rowsPerPage: 20, rowsNumber: 0 })

const STATUS_OPTIONS = [
  { label: 'Todos los estados', value: '' },
  { label: 'Válida', value: 'Valida' },
  { label: 'Utilizada', value: 'Utilizada' },
  { label: 'Anulada', value: 'Anulada' }
]

const STATUS_BADGES = {
  Valida: { label: 'Válida', color: 'primary' },
  Utilizada: { label: 'Utilizada', color: 'positive' },
  Anulada: { label: 'Anulada', color: 'negative' }
}

const columns = [
  { name: 'codigo', label: 'Código', field: 'codigoCorto', align: 'left' },
  { name: 'nombre', label: 'Titular', field: 'nombre', align: 'left' },
  { name: 'correo', label: 'Correo', field: 'correo', align: 'left' },
  { name: 'estado', label: 'Estado', field: 'estado', align: 'left' },
  { name: 'checkin', label: 'Check-in', field: 'fechaCheckIn', align: 'left' }
]

const eventOptions = computed(() =>
  events.value.map((e) => ({
    label: `${e.nombre} · ${date(e.fechaInicio)}`,
    value: e.eventoId
  }))
)

const selectedEvent = computed(() => events.value.find((e) => e.eventoId === selectedId.value))

function badge(value) {
  return STATUS_BADGES[value] || { label: value, color: 'grey' }
}

async function loadEvents() {
  loadingEvents.value = true
  eventsError.value = ''
  try {
    const res = await eventService.getMyEvents()
    events.value = Array.isArray(res) ? res : res?.items || []
    const fromQuery = Number(route.query.evento)
    if (fromQuery && events.value.some((e) => e.eventoId === fromQuery)) {
      selectedId.value = fromQuery
    } else if (events.value.length === 1) {
      selectedId.value = events.value[0].eventoId
    }
  } catch (e) {
    eventsError.value = e.message
  } finally {
    loadingEvents.value = false
  }
}

async function loadAttendees(page = pagination.value.page, { silent = false } = {}) {
  if (!selectedId.value) return
  if (!silent) loading.value = true
  error.value = ''
  try {
    const res = await eventService.getEventAttendees(selectedId.value, {
      buscar: search.value.trim(),
      estado: status.value,
      pagina: page,
      tamanoPagina: pagination.value.rowsPerPage
    })
    summary.value = res
    rows.value = res?.asistentes || []
    pagination.value = {
      ...pagination.value,
      page: res?.pagina || page,
      rowsNumber: res?.totalResultados || 0
    }
  } catch (e) {
    error.value = e.message
    rows.value = []
    summary.value = null
  } finally {
    loading.value = false
  }
}

function onRequest({ pagination: next }) {
  pagination.value.rowsPerPage = next.rowsPerPage
  loadAttendees(next.page)
}

function goToCheckIn() {
  if (!selectedEvent.value) return
  router.push({
    path: `/organizador/checkin/${selectedEvent.value.eventoId}`,
    query: { name: selectedEvent.value.nombre }
  })
}

let searchTimer
let pollTimer

watch(selectedId, () => {
  search.value = ''
  status.value = ''
  summary.value = null
  rows.value = []
  loadAttendees(1)
})
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadAttendees(1), 350)
})
watch(status, () => loadAttendees(1))

onMounted(() => {
  loadEvents()
  // El listado se actualiza solo para reflejar los check-in que se hagan en puerta.
  pollTimer = setInterval(() => {
    if (selectedId.value && !document.hidden) loadAttendees(pagination.value.page, { silent: true })
  }, 15000)
})
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  clearInterval(pollTimer)
})
</script>

<template>
  <q-page class="container">
    <div class="eyebrow">PANEL DE ORGANIZADOR · US-019</div>
    <h1 class="page-heading">Gestión de asistentes</h1>
    <p class="detail-description" style="margin-top: 0">
      Elige uno de tus eventos para ver las entradas vendidas, quiénes ya ingresaron y buscar una
      entrada por su código.
    </p>

    <q-banner v-if="eventsError" class="error" role="alert">{{ eventsError }}</q-banner>
    <div v-if="loadingEvents" class="empty"><q-spinner /> Cargando tus eventos…</div>

    <div v-else-if="!events.length && !eventsError" class="empty">
      Aún no tienes eventos organizados. Cuando publiques uno podrás gestionar a sus asistentes aquí.
    </div>

    <template v-else-if="events.length">
      <div class="surface" style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center">
        <q-select
          v-model="selectedId"
          :options="eventOptions"
          emit-value
          map-options
          outlined
          label="Evento"
          style="min-width: 320px; flex: 1"
        />
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="qr_code_scanner"
          label="Abrir Check-in QR"
          :disable="!selectedId"
          @click="goToCheckIn"
        />
      </div>

      <div v-if="!selectedId" class="empty">Selecciona un evento para ver sus asistentes.</div>

      <template v-else>
        <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>

        <div v-if="summary" class="attendee-stats">
          <div class="surface stat">
            <span class="muted">Entradas vendidas</span>
            <strong>{{ summary.entradasVendidas }}</strong>
          </div>
          <div class="surface stat">
            <span class="muted">Check-in realizados</span>
            <strong>{{ summary.checkInsRealizados }}</strong>
          </div>
          <div class="surface stat">
            <span class="muted">Válidas</span>
            <strong>{{ summary.validas }}</strong>
          </div>
          <div class="surface stat">
            <span class="muted">Utilizadas</span>
            <strong>{{ summary.utilizadas }}</strong>
          </div>
          <div class="surface stat">
            <span class="muted">Anuladas</span>
            <strong>{{ summary.anuladas }}</strong>
          </div>
        </div>

        <div class="attendee-filters">
          <q-input
            v-model="search"
            outlined
            dense
            clearable
            label="Buscar por código o identificador de entrada"
            style="min-width: 280px; flex: 1"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
          <q-select
            v-model="status"
            :options="STATUS_OPTIONS"
            emit-value
            map-options
            outlined
            dense
            label="Estado"
            style="min-width: 190px"
          />
          <q-btn flat no-caps icon="refresh" label="Actualizar" @click="loadAttendees()" />
        </div>

        <q-table
          v-model:pagination="pagination"
          flat
          bordered
          row-key="entradaId"
          :rows="rows"
          :columns="columns"
          :loading="loading"
          :rows-per-page-options="[10, 20, 50]"
          rows-per-page-label="Filas por página"
          no-data-label="No hay entradas que coincidan con la búsqueda."
          @request="onRequest"
        >
          <template #body-cell-codigo="props">
            <q-td :props="props">
              <code>{{ props.row.codigoCorto || props.row.entradaId.slice(0, 8) }}</code>
            </q-td>
          </template>
          <template #body-cell-estado="props">
            <q-td :props="props">
              <q-badge :color="badge(props.row.estado).color" :label="badge(props.row.estado).label" />
            </q-td>
          </template>
          <template #body-cell-checkin="props">
            <q-td :props="props">
              <span v-if="props.row.checkInRealizado">{{ date(props.row.fechaCheckIn) }}</span>
              <span v-else class="muted">Pendiente</span>
            </q-td>
          </template>
        </q-table>
      </template>
    </template>
  </q-page>
</template>

<style scoped>
.attendee-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 14px;
  margin: 0 0 8px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px;
  margin: 0;
}
.stat strong {
  font-size: 28px;
  line-height: 1;
}
.attendee-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin: 8px 0 16px;
}
</style>
