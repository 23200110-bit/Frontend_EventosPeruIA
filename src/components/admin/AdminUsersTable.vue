<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { eventService } from '@/services/eventService'
import { session } from '@/stores/authStore'

const emit = defineEmits(['toggle'])

const rows = ref([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const status = ref('')
const pagination = ref({ page: 1, rowsPerPage: 10, rowsNumber: 0 })

const STATUS_OPTIONS = [
  { label: 'Todos', value: '' },
  { label: 'Activos', value: 'Activo' },
  { label: 'Bloqueados', value: 'Bloqueado' }
]

const columns = [
  { name: 'nombre', label: 'Usuario', field: 'nombre', align: 'left' },
  { name: 'correo', label: 'Correo', field: 'correo', align: 'left' },
  { name: 'rol', label: 'Rol', field: 'esAdministrador', align: 'left' },
  { name: 'estado', label: 'Estado', field: 'estado', align: 'left' },
  { name: 'acciones', label: 'Acciones', field: 'usuarioId', align: 'right' }
]

async function load(page = pagination.value.page) {
  loading.value = true
  error.value = ''
  try {
    const res = await eventService.adminGetUsers({
      buscar: search.value.trim(),
      estado: status.value,
      pagina: page,
      tamanoPagina: pagination.value.rowsPerPage
    })
    rows.value = (res?.resultados || []).map((u) => ({
      ...u,
      nombre: `${u.nombres} ${u.apellidos}`.trim()
    }))
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

function isSelf(user) {
  return user.usuarioId === session.user?.userId
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
        debounce="0"
        label="Buscar por nombre o correo"
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
      row-key="usuarioId"
      :rows="rows"
      :columns="columns"
      :loading="loading"
      :rows-per-page-options="[10, 20, 50]"
      rows-per-page-label="Filas por página"
      no-data-label="No hay usuarios que coincidan con la búsqueda."
      @request="onRequest"
    >
      <template #body-cell-rol="props">
        <q-td :props="props">
          <q-badge v-if="props.row.esAdministrador" color="deep-purple" label="Administrador" />
          <span v-else class="muted">Usuario</span>
        </q-td>
      </template>

      <template #body-cell-estado="props">
        <q-td :props="props">
          <q-badge
            :color="props.row.estado === 'Activo' ? 'positive' : 'negative'"
            :label="props.row.estado"
          />
        </q-td>
      </template>

      <template #body-cell-acciones="props">
        <q-td :props="props">
          <span v-if="isSelf(props.row)" class="muted">Tu cuenta</span>
          <q-btn
            v-else-if="props.row.estado === 'Activo'"
            flat
            no-caps
            dense
            color="negative"
            icon="block"
            label="Bloquear"
            @click="emit('toggle', { user: props.row, estado: 'Bloqueado' })"
          />
          <q-btn
            v-else
            flat
            no-caps
            dense
            color="positive"
            icon="lock_open"
            label="Reactivar"
            @click="emit('toggle', { user: props.row, estado: 'Activo' })"
          />
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
