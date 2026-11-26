<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import EventCard from '@/components/events/EventCard.vue'
import { eventService } from '@/services/eventService'
import { date, money } from '@/utils/formatters'
import HomeHero from '@/components/events/HomeHero.vue'

const events = ref([])
const catalogStart = ref(null)

function scrollToCatalog() {
  const catalog = catalogStart.value
  if (!catalog) return
  catalog.focus({ preventScroll: true })
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  catalog.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
}

const categories = ref([])
const page = ref(1)
const busy = ref(false)
const error = ref('')
const next = ref(false)

const promoOpen = ref(false)
const promoEvent = ref(null)
const promoStorageKey = 'eventosperu:anuncio-inicio'
const promoRoute = (id) => ({ name: 'event-detail', params: { id } })
let exploring = true

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
      filter: {
        ...filter,
        soloPortadas: import.meta.env.VITE_SOLO_PORTADAS === 'true' ? 'true' : null
      }
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

async function showEventPromo() {
  if (sessionStorage.getItem(promoStorageKey)) return

  const candidates = events.value.filter(
    (event) => /^https?:\/\//i.test(event.imageUrl?.trim() ?? '') && event.availableSpots > 0
  )

  while (exploring && candidates.length > 0) {
    const index = Math.floor(Math.random() * candidates.length)
    const [event] = candidates.splice(index, 1)
    const image = new Image()
    image.src = event.imageUrl.trim()

    try {
      await image.decode()
    } catch {
      continue
    }

    if (!exploring) return

    promoEvent.value = event
    promoOpen.value = true
    sessionStorage.setItem(promoStorageKey, '1')
    return
  }
}

onBeforeUnmount(() => {
  exploring = false
})

onMounted(async () => {
  try {
    categories.value = await eventService.getCategories()
  } catch (e) {
    error.value = e.message
  }

  await search()
  await showEventPromo()
})
</script>

<template>
  <q-page>
    <q-dialog v-model="promoOpen" aria-labelledby="event-promo-title">
      <q-card v-if="promoEvent" class="event-promo">
        <router-link
          :to="promoRoute(promoEvent.id)"
          :aria-label="'Ver ' + promoEvent.name"
          class="event-promo__cover"
          @click="promoOpen = false"
        >
          <img :src="promoEvent.imageUrl.trim()" alt="" />
        </router-link>

        <q-btn
          round
          dense
          unelevated
          color="white"
          text-color="dark"
          icon="close"
          class="event-promo__close"
          aria-label="Cerrar anuncio"
          @click="promoOpen = false"
        />

        <q-card-section>
          <h2 id="event-promo-title" class="text-h6 q-mt-none q-mb-xs">
            {{ promoEvent.name }}
          </h2>

          <div class="text-body2">
            {{ date(promoEvent.startDate) }} · {{ promoEvent.city }}
          </div>

          <div v-if="promoEvent.venue" class="text-body2">
            {{ promoEvent.venue }}
          </div>

          <p
            v-if="promoEvent.description"
            class="event-promo__description text-body2 q-mt-sm q-mb-none"
          >
            {{ promoEvent.description }}
          </p>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <strong>
            {{ promoEvent.price === 0 ? 'Gratis' : money(promoEvent.price, promoEvent.currency) }}
          </strong>
        </q-card-section>
      </q-card>
    </q-dialog>

    <HomeHero @explore="scrollToCatalog" />

    <main ref="catalogStart" class="home-catalog" tabindex="-1">
      <div class="container">
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

        <div v-if="busy" class="empty">
          <q-spinner size="36px" color="primary" /> Buscando eventos…
        </div>

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
      </div>
    </main>
  </q-page>
</template>

<style scoped>
.home-catalog {
  scroll-margin-top: 96px;
  background: linear-gradient(
    180deg,
    var(--blue-deep) 0,
    var(--blue-mid) 85px,
    var(--blue-bright) 155px,
    var(--blue-wash) 315px
  );
}

.home-catalog .search-panel {
  margin-top: 0;
}

.event-promo {
  width: 450px;
  max-width: calc(100vw - 32px);
  border-radius: 18px;
}

.event-promo__cover {
  display: block;
}

.event-promo__cover img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.event-promo__close {
  position: absolute;
  top: 12px;
  right: 12px;
}

.event-promo__description {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
</style>
