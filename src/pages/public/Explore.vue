<script setup>
import { onMounted, reactive, ref } from 'vue'
import EventCard from '@/components/events/EventCard.vue'
import { eventService } from '@/services/eventService'

const events = ref([])
const categories = ref([])
const page = ref(1)
const busy = ref(false)
const error = ref('')
const next = ref(false)

const filter = reactive({
  query: '',
  categoryId: null,
  city: '',
  from: '',
  to: ''
})

async function search(reset = true) {
  if (reset) page.value = 1
  busy.value = true
  error.value = ''
  try {
    events.value = await eventService.searchEvents({
      page: page.value,
      pageSize: 12,
      filter
    })
    next.value = events.value.length === 12
  } catch (e) {
    error.value = e.message
    events.value = []
  } finally {
    busy.value = false
  }
}

function clear() {
  Object.assign(filter, {
    query: '',
    categoryId: null,
    city: '',
    from: '',
    to: ''
  })
  search()
}

async function move(delta) {
  page.value += delta
  await search(false)
}

onMounted(async () => {
  try {
    categories.value = await eventService.getCategories()
  } catch (e) {
    error.value = e.message
  }
  await search()
})
</script>

<template>
  <q-page>
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">TU CIUDAD TIENE MUCHO QUE CONTAR</div>
        <h1>Sal de la rutina.<br /><em>Encuentra tu próximo plan.</em></h1>
        <p>
          Conciertos, talleres, ferias y experiencias locales.<br />Descubre lo que pasa cerca de
          ti.
        </p>
        <div class="hero-chips">
          <span>Hecho en Perú</span>
          <span>Experiencias para todos</span>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <span class="orbit one"></span>
        <span class="orbit two"></span>
        <div class="ticket-art">
          <small>LA MEJOR ENTRADA</small>
          <strong>A un buen<br />recuerdo.</strong>
          <div class="ticket-line"></div>
          <span>ENCUENTRA · CONECTA · DISFRUTA</span>
        </div>
        <span class="star">✳</span>
      </div>
    </section>

    <main class="container">
      <q-form class="search-panel" @submit="search()">
        <q-input
          v-model="filter.query"
          outlined
          label="¿Qué te gustaría hacer?"
          clearable
          class="search-main"
        />
        <q-select
          v-model="filter.categoryId"
          outlined
          :options="categories"
          option-value="id"
          option-label="name"
          emit-value
          map-options
          clearable
          label="Categoría"
        />
        <q-input v-model="filter.city" outlined label="Ciudad" />
        <q-btn
          type="submit"
          color="primary"
          unelevated
          no-caps
          label="Buscar eventos"
          :loading="busy"
        />
        <q-input v-model="filter.from" outlined type="date" label="Desde" stack-label />
        <q-input v-model="filter.to" outlined type="date" label="Hasta" stack-label />
        <q-btn flat no-caps label="Limpiar filtros" @click="clear" />
      </q-form>

      <div class="section-title">
        <div>
          <div class="eyebrow">ELIGE TU EXPERIENCIA</div>
          <h2>Descubre eventos</h2>
        </div>
        <span>Página {{ page }}</span>
      </div>

      <q-banner v-if="error" class="error" role="alert">
        {{ error }} <q-btn flat label="Reintentar" @click="search()" />
      </q-banner>

      <div v-if="busy" class="empty"><q-spinner size="36px" color="primary" /> Buscando eventos…</div>

      <div v-else-if="!events.length && !error" class="empty">
        <h3>No hay eventos para estos filtros</h3>
        <p>Prueba otra ciudad, categoría o fecha.</p>
        <q-btn flat label="Limpiar filtros" @click="clear" />
      </div>

      <div v-else class="event-grid">
        <EventCard
          v-for="(event, index) in events"
          :key="event.id"
          :event="event"
          :index="index"
        />
      </div>

      <div class="pagination">
        <q-btn flat no-caps label="Anterior" :disable="page === 1 || busy" @click="move(-1)" />
        <q-btn flat no-caps label="Siguiente" :disable="!next || busy" @click="move(1)" />
      </div>
    </main>
  </q-page>
</template>