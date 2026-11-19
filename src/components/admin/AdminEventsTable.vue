<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { eventService } from '@/services/eventService'

const emit = defineEmits(['moderate'])

const rows = ref([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const status = ref('')
const pagination = ref({ page: 1, rowsPerPage: 10, rowsNumber: 0 })

const STATUS_OPTIONS = [
  { label: 'Todos', value: '' },
  { label: 'Borrador', value: 'Borrador' },
  { label: 'Publicado', value: 'Publicado' },
  { label: 'Finalizado', value: 'Finalizado' },
  { label: 'Cancelado', value: 'Cancelado' }
]

const columns = [
  { name: 'eventoId', label: 'ID', field: 'eventoId', align: 'left' },
  { name: 'nombre', label: 'Evento', field: 'nombre', align: 'left' },
  { name: 'organizadorId', label: 'Organizador', field: 'organizadorId', align: 'left' },
  { name: 'estado', label: 'Estado', field: 'estado', align: 'left' },
  { name: 'moderacion', label: 'Moderación', field: 'estadoModeracion', align: 'left' },
  { name: 'acciones', label: 'Acciones', field: 'eventoId', align: 'right' }
]

const MODERATION_LABELS = {
  Aprobado: { label: 'Aprobado', color: 'positive' },
  PendienteRevision: { label: 'Pendiente de revisión', color: 'warning' },
  Suspendido: { label: 'Suspendido', color: 'orange' },
  Retirado: { label: 'Retirado', color: 'negative' }
}

function moderationBadge(value) {
  return MODERATION_LABELS[value] || { label: value, color: 'grey' }
}

function canModerate(event) {
  return event.estado !== 'Cancelado' && event.estado !== 'Finalizado'
}

async function load(page = pagination.value.page) {
  loading.value = true
  error.value = ''
  try {
    const res = await eventService.adminGetEvents({
      buscar: search.value.trim(),
      estado: status.value,
      pagina: page,
      tamanoPagina: pagination.value.rowsPerPage
    })
    rows.value = res?.resultados || []
    pagination.value = {
      ...pagination.value,
      page: res?.pagina || page,
      rowsNumber: res?.total || 0
    }
  } catch (e) {
    error.value = e.message
    rows.value = []
  } finally {
    loading.value = false
  }
}

function onRequest({ pagination: next }) {
  pagination.value.rowsPerPage = next.rowsPerPage
  load(next.page)
}

let timer
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(() => load(1), 350)
})
watch(status, () => load(1))

onMounted(() => load(1))
onBeforeUnmount(() => clearTimeout(timer))

defineExpose({ refresh: () => load() })
</script>

<template>
  <div>
    <div class="admin-filters">
      <q-input
        v-model="search"
        outlined
        dense
        clearable
        label="Buscar por nombre del evento"
        style="min-width: 260px; flex: 1"
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
        style="min-width: 170px"
      />
    </div>

    <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>

    <q-table
      v-model:pagination="pagination"
      flat
      bordered
      row-key="eventoId"
      :rows="rows"
      :columns="columns"
      :loading="loading"
      :rows-per-page-options="[10, 20, 50]"
      rows-per-page-label="Filas por página"
      no-data-label="No hay eventos que coincidan con la búsqueda."
      @request="onRequest"
    >
      <template #body-cell-moderacion="props">
        <q-td :props="props">
          <q-badge
            :color="moderationBadge(props.row.estadoModeracion).color"
            :label="moderationBadge(props.row.estadoModeracion).label"
          />
        </q-td>
      </template>

      <template #body-cell-acciones="props">
        <q-td :props="props">
          <template v-if="canModerate(props.row)">
            <q-btn
              flat
              no-caps
              dense
              color="orange"
              icon="pause_circle"
              label="Suspender"
              :disable="props.row.estadoModeracion === 'Suspendido'"
              @click="emit('moderate', { event: props.row, accion: 'Suspender' })"
            />
            <q-btn
              flat
              no-caps
              dense
              color="negative"
              icon="delete_forever"
              label="Retirar"
              class="q-ml-sm"
              :disable="props.row.estadoModeracion === 'Retirado'"
              @click="emit('moderate', { event: props.row, accion: 'Retirar' })"
            />
          </template>
          <span v-else class="muted">Sin acciones</span>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<style scoped>
.admin-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
</style>
