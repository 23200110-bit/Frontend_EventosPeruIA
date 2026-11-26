<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import EventCard from '@/components/events/EventCard.vue'
import LoadError from '@/components/common/LoadError.vue'
import { eventService } from '@/services/eventService'
import { limaDayKey } from '@/utils/formatters'

const LOAD_EVENTS_FAILED = 'No pudimos cargar los eventos a tiempo. Verifica tu conexión e inténtalo otra vez.'

function loadMessage(e) {
  return e && (e.kind === 'timeout' || e.kind === 'network') ? LOAD_EVENTS_FAILED : (e && e.message) || LOAD_EVENTS_FAILED
}

// Íconos por nombre de categoría (cualquier otra usa el ícono genérico)
const CATEGORY_ICONS = [
  [/rock|metal|punk/i, 'music_note'],
  [/electr|techno|house|dj/i, 'graphic_eq'],
  [/cumbia|salsa|fiesta|baile/i, 'celebration'],
  [/jazz|blues|cl[aá]sica|piano/i, 'piano'],
  [/teatro|comedia|stand/i, 'theater_comedy'],
  [/taller|curso|workshop/i, 'palette'],
  [/feria|gastro|comida/i, 'storefront'],
  [/deporte|running|f[uú]tbol/i, 'sports_soccer'],
  [/conferencia|charla|tech/i, 'mic']
]

function categoryIcon(name) {
  const hit = CATEGORY_ICONS.find(([re]) => re.test(String(name || '')))
  return hit ? hit[1] : 'local_activity'
}

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

// Atajos de fecha y precio (el precio se filtra sobre la página cargada)
const quick = reactive({
  when: '',
  price: ''
})

const CITY_SUGGESTIONS = ['Lima', 'Arequipa', 'Cusco', 'Trujillo', 'Chiclayo', 'Piura', 'Iquitos', 'Huancayo']
const cityOptions = ref(CITY_SUGGESTIONS.slice())

const PRICE_OPTIONS = [
  { value: '', label: 'Todos los precios' },
  { value: 'free', label: 'Gratis' },
  { value: 'upto50', label: 'Hasta S/ 50' },
  { value: 'upto100', label: 'Hasta S/ 100' },
  { value: 'over100', label: 'Más de S/ 100' }
]

const dateDraft = reactive({ from: '', to: '' })

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

// Fecha local YYYY-MM-DD (no UTC: de noche en Perú UTC ya es el día siguiente)
function localDay(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function weekendRange() {
  const today = new Date()
  const day = today.getDay()
  const start = new Date(today)
  if (day !== 5 && day !== 6 && day !== 0) {
    start.setDate(today.getDate() + (5 - day))
  }
  const sunday = new Date(today)
  sunday.setDate(today.getDate() + (day === 0 ? 0 : 7 - day))
  return { from: localDay(start), to: localDay(sunday) }
}

const categoryLabel = computed(() => {
  const found = categories.value.find((c) => c.id === filter.categoryId)
  return found ? found.name : 'Género'
})

const priceLabel = computed(() => {
  const found = PRICE_OPTIONS.find((p) => p.value === quick.price)
  return quick.price && found ? found.label : 'Precio'
})

function shortDay(value) {
  return value.slice(8) + '/' + value.slice(5, 7)
}

const datesLabel = computed(() => {
  if (quick.when !== 'range') return 'Fechas'
  if (filter.from && filter.to) return shortDay(filter.from) + ' – ' + shortDay(filter.to)
  if (filter.from) return 'Desde ' + shortDay(filter.from)
  if (filter.to) return 'Hasta ' + shortDay(filter.to)
  return 'Fechas'
})

const hasFilters = computed(() =>
  Boolean(filter.query || filter.categoryId || filter.city || filter.from || filter.to || quick.price)
)

function matchesPrice(event) {
  const price = Number(event.price) || 0
  if (quick.price === 'free') return price === 0
  if (quick.price === 'upto50') return price <= 50
  if (quick.price === 'upto100') return price <= 100
  if (quick.price === 'over100') return price > 100
  return true
}

const visibleEvents = computed(() =>
  events.value
    .filter(matchesPrice)
    .slice()
    .sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0))
)

const curatedMode = computed(() => !hasFilters.value && !quick.when && page.value === 1)

function soldRatio(event) {
  const cap = Number(event.capacity) || 0
  const spots = typeof event.availableSpots === 'number' ? event.availableSpots : null
  if (!cap || spots === null) return 0
  return (cap - spots) / cap
}

function soldOut(event) {
  return event.isSoldOut === true || (typeof event.availableSpots === 'number' && event.availableSpots <= 0)
}

const sections = computed(() => {
  const list = visibleEvents.value
  const range = weekendRange()
  const inWeekend = (e) => {
    if (!e.startDate) return false
    const key = limaDayKey(e.startDate)
    return key >= range.from && key <= range.to
  }
  const out = []
  const weekend = list.filter(inWeekend).slice(0, 3)
  if (weekend.length) out.push({ key: 'weekend', title: 'Este fin de semana', icon: 'weekend', items: weekend })
  const trending = list
    .filter((e) => !soldOut(e) && soldRatio(e) >= 0.5)
    .sort((a, b) => soldRatio(b) - soldRatio(a))
    .slice(0, 3)
  if (trending.length) out.push({ key: 'trending', title: 'Tendencias', icon: 'local_fire_department', items: trending })
  const free = list.filter((e) => !(Number(e.price) > 0)).slice(0, 3)
  if (free.length) out.push({ key: 'free', title: 'Gratis', icon: 'redeem', items: free })
  return out
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
    error.value = loadMessage(e)
    events.value = []
  } finally {
    busy.value = false
  }
}

function setWhen(kind) {
  if (quick.when === kind) {
    quick.when = ''
    filter.from = ''
    filter.to = ''
  } else if (kind === 'today') {
    quick.when = 'today'
    filter.from = localDay(new Date())
    filter.to = filter.from
  } else if (kind === 'weekend') {
    quick.when = 'weekend'
    const range = weekendRange()
    filter.from = range.from
    filter.to = range.to
  }
  search()
}

function applyDates() {
  if (!dateDraft.from && !dateDraft.to) {
    clearDates()
    return
  }
  quick.when = 'range'
  filter.from = dateDraft.from
  filter.to = dateDraft.to
  search()
}

function clearDates() {
  quick.when = ''
  filter.from = ''
  filter.to = ''
  dateDraft.from = ''
  dateDraft.to = ''
  search()
}

function setCategory(id) {
  filter.categoryId = id
  search()
}

function setPrice(value) {
  quick.price = value
}

function filterCities(val, update) {
  update(() => {
    const needle = String(val || '').toLowerCase()
    cityOptions.value = CITY_SUGGESTIONS.filter((c) => c.toLowerCase().includes(needle))
  })
}

function setCity(val) {
  filter.city = val || ''
}

function clear() {
  Object.assign(filter, {
    query: '',
    categoryId: null,
    city: '',
    from: '',
    to: ''
  })
  quick.when = ''
  quick.price = ''
  dateDraft.from = ''
  dateDraft.to = ''
  search()
}

async function move(delta) {
  page.value += delta
  await search(false)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(async () => {
  try {
    categories.value = await eventService.getCategories()
  } catch {
    // Sin categorías la página sigue funcionando; el error visible lo da la carga de eventos.
    categories.value = []
  }
  await search()
})
</script>

<template>
  <q-page class="explore-page">
    <section class="hero hero--compact">
      <div class="hero-copy">
        <div class="eyebrow">TU CIUDAD TIENE MUCHO QUE CONTAR</div>
        <h1>Sal de la rutina. <em>Encuentra tu próximo plan.</em></h1>
        <p>Conciertos, talleres, ferias y experiencias locales cerca de ti.</p>

        <!-- Buscador dual: evento + ciudad -->
        <q-form class="ui-search" role="search" @submit="search()">
          <q-input
            v-model="filter.query"
            outlined
            rounded
            clearable
            class="ui-search__query"
            placeholder="Busca artista, evento o sala"
            aria-label="Buscar por artista, evento o sala"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
          <q-select
            :model-value="filter.city || null"
            outlined
            rounded
            use-input
            fill-input
            hide-selected
            clearable
            input-debounce="0"
            new-value-mode="add-unique"
            :options="cityOptions"
            class="ui-search__city"
            placeholder="Ciudad"
            aria-label="Ciudad"
            @filter="filterCities"
            @input-value="setCity"
            @update:model-value="setCity"
          >
            <template #prepend><q-icon name="place" /></template>
          </q-select>
          <q-btn
            type="submit"
            color="primary"
            unelevated
            rounded
            no-caps
            label="Buscar"
            icon="search"
            :loading="busy"
            class="ui-search__btn"
          />
        </q-form>
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
      <!-- Categorías visibles (estilo Joinnus/Eventbrite) -->
      <nav v-if="categories.length" class="ui-cats" aria-label="Categorías">
        <button
          type="button"
          class="ui-cat"
          :class="{ 'is-active': !filter.categoryId }"
          :aria-pressed="!filter.categoryId"
          @click="setCategory(null)"
        >
          <q-icon name="apps" size="22px" aria-hidden="true" />
          <span>Todo</span>
        </button>
        <button
          v-for="c in categories"
          :key="c.id"
          type="button"
          class="ui-cat"
          :class="{ 'is-active': filter.categoryId === c.id }"
          :aria-pressed="filter.categoryId === c.id"
          @click="setCategory(filter.categoryId === c.id ? null : c.id)"
        >
          <q-icon :name="categoryIcon(c.name)" size="22px" aria-hidden="true" />
          <span>{{ c.name }}</span>
        </button>
      </nav>

      <!-- Filtros rápidos -->
      <div class="ui-pills" role="toolbar" aria-label="Filtros rápidos">
        <button
          type="button"
          class="ui-pill"
          :class="{ 'is-active': quick.when === 'today' }"
          :aria-pressed="quick.when === 'today'"
          @click="setWhen('today')"
        >
          Hoy
        </button>
        <button
          type="button"
          class="ui-pill"
          :class="{ 'is-active': quick.when === 'weekend' }"
          :aria-pressed="quick.when === 'weekend'"
          @click="setWhen('weekend')"
        >
          Este fin de semana
        </button>

        <button type="button" class="ui-pill" :class="{ 'is-active': quick.when === 'range' }">
          <q-icon name="calendar_month" size="16px" aria-hidden="true" />
          {{ datesLabel }}
          <q-icon name="expand_more" size="16px" aria-hidden="true" />
          <q-menu anchor="bottom left" self="top left" :offset="[0, 8]">
            <div class="ui-dates">
              <q-input v-model="dateDraft.from" outlined dense type="date" label="Desde" stack-label />
              <q-input v-model="dateDraft.to" outlined dense type="date" label="Hasta" stack-label />
              <div class="ui-dates__actions">
                <q-btn v-close-popup flat no-caps label="Quitar" @click="clearDates" />
                <q-btn v-close-popup unelevated rounded no-caps color="primary" label="Aplicar" @click="applyDates" />
              </div>
            </div>
          </q-menu>
        </button>

        <button type="button" class="ui-pill" :class="{ 'is-active': quick.price }">
          <q-icon name="sell" size="16px" aria-hidden="true" />
          {{ priceLabel }}
          <q-icon name="expand_more" size="16px" aria-hidden="true" />
          <q-menu anchor="bottom left" self="top left" :offset="[0, 8]" auto-close>
            <q-list style="min-width: 180px">
              <q-item
                v-for="p in PRICE_OPTIONS"
                :key="p.value || 'all'"
                clickable
                :active="quick.price === p.value"
                @click="setPrice(p.value)"
              >
                <q-item-section>{{ p.label }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </button>

        <button v-if="hasFilters" type="button" class="ui-pill ui-pill--ghost" @click="clear">
          <q-icon name="close" size="16px" aria-hidden="true" />
          Limpiar
        </button>
      </div>

      <LoadError v-if="error" :message="error" :busy="busy" @retry="search(false)" />

      <div v-else-if="busy" class="ui-skeleton-grid" aria-busy="true" aria-label="Buscando eventos">
        <div v-for="n in 6" :key="n" class="ui-skeleton"></div>
      </div>

      <div v-else-if="!visibleEvents.length" class="ui-empty">
        <q-icon name="event_busy" size="44px" aria-hidden="true" />
        <h3>No hay eventos para estos filtros</h3>
        <p>Prueba otra ciudad, categoría o fecha.</p>
        <q-btn v-if="hasFilters" unelevated rounded no-caps color="primary" label="Limpiar filtros" @click="clear" />
      </div>

      <template v-else>
        <!-- Secciones curadas, sólo sin filtros -->
        <template v-if="curatedMode">
          <section v-for="s in sections" :key="s.key" class="ui-rail">
            <h2 class="ui-rail__title">
              <q-icon :name="s.icon" size="22px" aria-hidden="true" />
              {{ s.title }}
            </h2>
            <div class="event-grid ui-rail__grid">
              <EventCard v-for="(event, index) in s.items" :key="s.key + '-' + event.id" :event="event" :index="index" />
            </div>
          </section>
        </template>

        <section class="ui-rail">
          <div class="ui-rail__head">
            <h2 class="ui-rail__title">
              <q-icon :name="curatedMode ? 'event' : 'search'" size="22px" aria-hidden="true" />
              {{ curatedMode ? 'Próximos eventos' : 'Resultados' }}
            </h2>
            <span class="ui-rail__meta">
              Página {{ page }}
              <template v-if="quick.price"> · precio filtrado en esta página</template>
            </span>
          </div>
          <div class="event-grid">
            <EventCard v-for="(event, index) in visibleEvents" :key="event.id" :event="event" :index="index" />
          </div>
        </section>
      </template>

      <div v-if="!error" class="pagination">
        <q-btn flat rounded no-caps icon="chevron_left" label="Anterior" :disable="page === 1 || busy" @click="move(-1)" />
        <q-btn flat rounded no-caps icon-right="chevron_right" label="Siguiente" :disable="!next || busy" @click="move(1)" />
      </div>
    </main>
  </q-page>
</template>

<style scoped>
.ui-search {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 14px;
  border-radius: 22px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  box-shadow: 0 10px 30px -18px rgba(20, 10, 60, 0.35);
  margin-top: 20px;
  position: relative;
  z-index: 2;
}

.ui-search__btn {
  min-height: 48px;
  padding: 0 22px;
  font-weight: 800;
}

.ui-pills {
  display: flex;
  gap: 8px;
  margin: 18px 0 6px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
}

.ui-pills::-webkit-scrollbar {
  display: none;
}

.ui-pill {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.ui-pill:hover {
  border-color: var(--brand);
}

.ui-pill:active {
  transform: scale(0.97);
}

.ui-pill:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}

.ui-pill.is-active {
  background: var(--brand);
  border-color: var(--brand);
  color: #ffffff;
}

.ui-pill--ghost {
  background: transparent;
  color: var(--text-secondary);
}

.ui-dates {
  display: grid;
  gap: 10px;
  padding: 14px;
  min-width: 240px;
}

.ui-dates__actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.ui-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 48px 16px;
  border: 1px dashed var(--border-color);
  border-radius: 22px;
  color: var(--text-secondary);
}

.ui-empty h3 {
  margin: 6px 0 0;
  font-size: 20px;
  color: var(--text-primary);
}

.ui-empty p {
  margin: 0 0 10px;
}

.ui-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.ui-skeleton {
  height: 320px;
  border-radius: 20px;
  background: linear-gradient(90deg, var(--bg-secondary) 0%, var(--border-color) 50%, var(--bg-secondary) 100%);
  background-size: 200% 100%;
  animation: ui-shimmer 1.2s ease-in-out infinite;
}

@keyframes ui-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (max-width: 760px) {
  .ui-search {
    grid-template-columns: 1fr;
  }
  .ui-search__btn {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-pill,
  .ui-skeleton {
    transition: none;
    animation: none;
  }
}
/* Portada compacta: buscador dentro, para ver categorías y eventos sin bajar */
.hero--compact {
  min-height: 0;
  padding-top: 36px;
  padding-bottom: 14px;
  align-items: center;
}

.hero--compact h1 {
  font-size: clamp(30px, 3.4vw, 46px);
  margin-bottom: 10px;
}

.hero--compact .eyebrow {
  margin-bottom: 12px;
}

.hero--compact p {
  margin: 0 0 18px;
  line-height: 1.5;
}

.hero--compact .ui-search {
  margin-top: 0;
  max-width: 760px;
}

.hero--compact .hero-art {
  transform: scale(0.72);
  transform-origin: top right;
  height: 230px;
  align-self: flex-start;
}

/* Categorías */
.ui-cats {
  display: flex;
  gap: 10px;
  margin: 6px 0 4px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 4px;
}

.ui-cats::-webkit-scrollbar {
  display: none;
}

.ui-cat {
  flex: 0 0 auto;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 96px;
  min-height: 78px;
  padding: 10px 14px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.ui-cat .q-icon {
  color: var(--brand);
}

.ui-cat:hover {
  border-color: var(--brand);
  transform: translateY(-1px);
}

.ui-cat:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}

.ui-cat.is-active {
  background: var(--brand);
  border-color: var(--brand);
  color: #ffffff;
}

.ui-cat.is-active .q-icon {
  color: #ffffff;
}

/* Secciones */
.ui-rail {
  margin-top: 30px;
}

.ui-rail__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.ui-rail__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--text-primary);
}

.ui-rail__title .q-icon {
  color: var(--buy);
}

.ui-rail__meta {
  font-size: 13px;
  color: var(--text-secondary);
}

@media (max-width: 900px) {
  .hero--compact .hero-art {
    display: none;
  }
}

@media (max-width: 600px) {
  .ui-rail__grid {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: 14px;
    padding-bottom: 6px;
  }
  .ui-rail__grid > * {
    flex: 0 0 82%;
    scroll-snap-align: start;
  }
  .ui-rail__title {
    font-size: 20px;
  }
}
</style>
