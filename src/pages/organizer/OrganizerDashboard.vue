<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { eventService } from '@/services/eventService'
import { reportService } from '@/services/reportService'
import { session } from '@/stores/authStore'
import { date, money } from '@/utils/formatters'

const emptyFilters = () => ({ eventoId: null, fechaInicio: '', fechaFin: '' })
const filters = reactive(emptyFilters())
const events = ref([])
const report = ref(null)
const busy = ref(false)
const eventsBusy = ref(false)
const downloading = ref('')
const reportError = ref('')
const eventsError = ref('')
let sessionVersion = 0

const options = computed(() => events.value.map((event) => ({
  label: event.nombre,
  value: event.eventoId
})))
const invalid = computed(() => Boolean(
  filters.fechaInicio && filters.fechaFin && filters.fechaInicio > filters.fechaFin
))
const applied = computed(() => report.value?.filtrosAplicados ?? {})
const changed = computed(() => report.value && (
  (filters.eventoId ?? null) !== (applied.value.eventoId ?? null) ||
  filters.fechaInicio !== (applied.value.fechaInicio || '') ||
  filters.fechaFin !== (applied.value.fechaFin || '')
))
const appliedEvent = computed(() => {
  const id = applied.value.eventoId
  if (id == null) return 'Todos mis eventos'
  return report.value.resumenEventos.find((event) => event.eventoId === id)?.nombreEvento
    || options.value.find((item) => item.value === id)?.label
    || `Evento ${id}`
})
const daily = computed(() => report.value?.evolucionVentasDiarias ?? [])
const maxSales = computed(() => daily.value.reduce(
  (max, day) => Math.max(max, day.entradasVendidas), 1
))

function current(version) {
  return session.token && version === sessionVersion
}

async function loadEvents() {
  const version = sessionVersion
  eventsBusy.value = true
  eventsError.value = ''

  try {
    const result = await eventService.getMyEvents()
    if (current(version)) events.value = Array.isArray(result) ? result : result?.items ?? []
  } catch (error) {
    if (current(version)) eventsError.value = error.message || 'No se pudieron cargar los eventos.'
  } finally {
    if (current(version)) eventsBusy.value = false
  }
}

async function loadReport() {
  if (!session.token || busy.value || invalid.value || downloading.value) return

  const version = sessionVersion
  busy.value = true
  report.value = null
  reportError.value = ''

  try {
    const result = await reportService.getDashboard({ ...filters })
    if (current(version)) report.value = result
  } catch (error) {
    if (current(version)) reportError.value = error.message || 'No se pudo cargar el reporte.'
  } finally {
    if (current(version)) busy.value = false
  }
}

function reset() {
  Object.assign(filters, emptyFilters())
  loadReport()
}

async function download(format) {
  const id = report.value?.reporteId
  if (!id || changed.value || busy.value || downloading.value) return

  const version = sessionVersion
  downloading.value = format
  reportError.value = ''

  try {
    if (format === 'excel') await reportService.downloadExcel(id)
    else await reportService.downloadPdf(id)
  } catch (error) {
    if (current(version)) reportError.value = error.message || 'No se pudo descargar el reporte.'
  } finally {
    if (current(version)) downloading.value = ''
  }
}

onMounted(() => {
  if (!session.token) return
  loadEvents()
  loadReport()
})

watch(() => session.token, async (token) => {
  const version = ++sessionVersion
  Object.assign(filters, emptyFilters())
  events.value = []
  report.value = null
  busy.value = false
  eventsBusy.value = false
  downloading.value = ''
  reportError.value = ''
  eventsError.value = ''

  if (token) {
    await nextTick()
    if (!current(version)) return
    loadEvents()
    loadReport()
  }
}, { flush: 'sync' })

onBeforeUnmount(() => {
  sessionVersion += 1
})
</script>

<template>
  <q-page class="container">
    <q-btn flat no-caps color="white" icon="arrow_back" label="Volver a Mis eventos" to="/organizador/mis-eventos" />
    <h1 class="page-heading">Reportes de ventas</h1>

    <section class="surface q-pa-md q-mb-md">
      <q-form class="report-filters" @submit="loadReport">
        <q-select
          v-model="filters.eventoId"
          :options="options"
          emit-value
          map-options
          clearable
          outlined
          stack-label
          label="Evento"
          placeholder="Todos mis eventos"
          :loading="eventsBusy"
          :disable="eventsBusy || busy || !!downloading"
        />
        <q-input
          v-model="filters.fechaInicio" outlined stack-label type="date" label="Desde"
          :disable="busy || !!downloading"
        />
        <q-input
          v-model="filters.fechaFin" outlined stack-label type="date" label="Hasta"
          :disable="busy || !!downloading" :error="invalid"
          error-message="La fecha de fin debe ser igual o posterior al inicio."
        />
        <div class="q-gutter-sm">
          <q-btn
            type="submit" color="primary" label="Aplicar filtros" :loading="busy"
            :disable="invalid || !!downloading"
          />
          <q-btn flat label="Limpiar filtros" :disable="busy || !!downloading" @click="reset" />
        </div>
      </q-form>

      <q-banner v-if="eventsError" class="error q-mt-sm" role="alert">
        {{ eventsError }}
        <template #action><q-btn flat label="Reintentar" @click="loadEvents" /></template>
      </q-banner>
    </section>

    <q-banner v-if="reportError" class="error q-mb-md" role="alert">{{ reportError }}</q-banner>
    <div v-if="busy" class="empty" role="status">Cargando reporte…</div>

    <template v-if="report">
      <section class="surface q-pa-md q-mb-md">
        <h2>Resumen por evento</h2>
        <p>{{ appliedEvent }} · Desde {{ applied.fechaInicio || 'sin límite' }} · Hasta {{ applied.fechaFin || 'sin límite' }}</p>
        <p>Generado el {{ date(report.fechaGeneracion) }} (hora de Lima)</p>

        <div class="q-gutter-sm q-mb-md">
          <q-btn
            outline label="Excel" icon="download" :loading="downloading === 'excel'"
            :disable="!report.reporteId || !!changed || !!downloading" @click="download('excel')"
          />
          <q-btn
            outline label="PDF" icon="download" :loading="downloading === 'pdf'"
            :disable="!report.reporteId || !!changed || !!downloading" @click="download('pdf')"
          />
        </div>

        <p v-if="changed" role="status">Aplica los nuevos filtros antes de exportar.</p>
        <p v-if="!report.tieneDatos" role="status">{{ report.mensajeInformativo }}</p>

        <dl class="report-totals">
          <div><dt>Entradas vendidas</dt><dd>{{ report.granTotalEntradasActivas }}</dd></div>
          <div><dt>Ingresos en soles</dt><dd>{{ money(report.granTotalIngresosSoles, 'PEN') }}</dd></div>
          <div v-if="report.granTotalIngresosUsd">
            <dt>Ingresos en dólares</dt><dd>{{ money(report.granTotalIngresosUsd, 'USD') }}</dd>
          </div>
        </dl>

        <q-markup-table v-if="report.resumenEventos.length" flat bordered>
          <thead>
            <tr>
              <th scope="col">Evento</th><th scope="col">Válidas</th><th scope="col">Utilizadas</th>
              <th scope="col">Vendidas</th><th scope="col">Cupos actuales</th><th scope="col">Ingresos</th>
              <th scope="col">Anuladas</th><th scope="col">Reembolsos pendientes</th>
              <th scope="col">Monto pendiente</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in report.resumenEventos" :key="event.eventoId">
              <th scope="row">{{ event.nombreEvento }} <small>{{ event.estadoEvento }}</small></th>
              <td>{{ event.entradasValidasVendidas }}</td>
              <td>{{ event.entradasUtilizadas }}</td>
              <td>{{ event.totalEntradasActivas }}</td>
              <td>{{ event.capacidadDisponible }}</td>
              <td>
                {{ money(event.ingresosTotalesSoles, 'PEN') }}
                <div v-if="event.ingresosTotalesUsd">{{ money(event.ingresosTotalesUsd, 'USD') }}</div>
              </td>
              <td>{{ event.entradasAnuladasCount }}</td>
              <td>{{ event.entradasPendientesReembolso }}</td>
              <td>
                {{ money(event.montoPendienteReembolsoSoles, 'PEN') }}
                <div v-if="event.montoPendienteReembolsoUsd">{{ money(event.montoPendienteReembolsoUsd, 'USD') }}</div>
              </td>
            </tr>
          </tbody>
        </q-markup-table>
      </section>

      <section class="surface q-pa-md">
        <h2>Evolución diaria de ventas</h2>
        <p v-if="!daily.length">No hay ventas en las fechas seleccionadas.</p>
        <q-markup-table v-else flat bordered>
          <thead>
            <tr><th scope="col">Día (Lima)</th><th scope="col">Vendidas</th><th scope="col">Ingresos</th></tr>
          </thead>
          <tbody>
            <tr v-for="day in daily" :key="day.fecha">
              <th scope="row">{{ day.fecha }}</th>
              <td>
                <q-linear-progress :value="day.entradasVendidas / maxSales" color="primary" aria-hidden="true" />
                {{ day.entradasVendidas }}
              </td>
              <td>
                {{ money(day.montoTotalSoles, 'PEN') }}
                <div v-if="day.montoTotalUsd">{{ money(day.montoTotalUsd, 'USD') }}</div>
              </td>
            </tr>
          </tbody>
        </q-markup-table>
      </section>
    </template>
  </q-page>
</template>

<style scoped>
.report-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  align-items: start;
  gap: 12px;
}

.report-totals {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
}

.report-totals dd {
  margin: 0;
  font-weight: 700;
}
</style>
