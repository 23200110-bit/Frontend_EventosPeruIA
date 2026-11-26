<script setup>
import { ref, watch, computed } from 'vue'
import { money, shortDate } from '@/utils/formatters'

const props = defineProps({
  event: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    default: 0
  }
})

const imageFailed = ref(false)

const spots = computed(() =>
  typeof props.event.availableSpots === 'number' ? props.event.availableSpots : null
)

// Agotado sólo con dato explícito: un campo ausente no marca el evento como agotado
const isSoldOut = computed(() => props.event.isSoldOut === true || (spots.value !== null && spots.value <= 0))

// Últimas entradas: quedan 5 o menos, o el 10 % del aforo si el aforo es grande
const hasLimitedTickets = computed(() => {
  if (isSoldOut.value || spots.value === null) return false
  const capacity = Number(props.event.capacity) || 0
  const limit = Math.max(5, Math.ceil(capacity * 0.1))
  return spots.value > 0 && spots.value <= limit
})

const priceLabel = computed(() => {
  const price = Number(props.event.price)
  if (!price) return 'Gratis'
  return 'desde ' + money(price, props.event.currency || 'PEN')
})

const place = computed(() =>
  [props.event.venue || props.event.address, props.event.city].filter(Boolean).join(' · ')
)

watch(
  () => props.event.imageUrl,
  () => {
    imageFailed.value = false
  }
)
</script>

<template>
  <router-link :to="'/evento/' + event.id" class="event-card ui-card">
    <div class="event-cover ui-cover" :class="'cover-' + (index % 4)">
      <img
        v-if="event.imageUrl && !imageFailed"
        :key="event.imageUrl"
        :src="event.imageUrl"
        :alt="'Imagen de ' + event.name"
        loading="lazy"
        decoding="async"
        @error="imageFailed = true"
      />
      <strong v-else class="ui-cover-initial" aria-hidden="true">{{ (event.name || '?').slice(0, 1) }}</strong>
      <div class="ui-cover-shade" aria-hidden="true"></div>
      <div class="ui-cover-badges">
        <span v-if="event.category" class="ui-tag ui-tag--category">{{ event.category }}</span>
        <span v-if="isSoldOut" class="ui-tag ui-tag--soldout">Agotado</span>
        <span v-else-if="hasLimitedTickets" class="ui-tag ui-tag--limited">Últimas entradas</span>
      </div>
    </div>

    <div class="event-info ui-card-body">
      <small class="ui-card-date">{{ shortDate(event.startDate) }}</small>
      <h3 class="ui-card-title">{{ event.name }}</h3>
      <p v-if="place" class="ui-card-place">
        <q-icon name="place" size="16px" aria-hidden="true" />
        <span>{{ place }}</span>
      </p>
      <div class="event-bottom ui-card-bottom">
        <strong class="ui-card-price" :class="{ 'is-free': priceLabel === 'Gratis' }">{{ priceLabel }}</strong>
        <q-icon name="arrow_forward" size="18px" class="ui-card-arrow" aria-hidden="true" />
      </div>
    </div>
  </router-link>
</template>

<style scoped>
.ui-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.ui-card:hover,
.ui-card:focus-visible {
  transform: translateY(-4px);
  border-color: var(--brand);
  box-shadow: 0 14px 32px -14px rgba(20, 10, 60, 0.45);
}

.ui-card:active {
  transform: translateY(-1px) scale(0.99);
}

.ui-cover {
  position: relative;
  aspect-ratio: 4 / 3;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ui-cover {
  background: linear-gradient(135deg, #2e2170, #7c5cf5);
}

.ui-cover.cover-1 {
  background: linear-gradient(135deg, #7d2450, #e0567a);
}

.ui-cover.cover-2 {
  background: linear-gradient(135deg, #0d5444, #24a37f);
}

.ui-cover.cover-3 {
  background: linear-gradient(135deg, #6e420f, #e0a53c);
}

.ui-cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.ui-card:hover .ui-cover img {
  transform: scale(1.04);
}

.ui-cover-initial {
  position: relative;
  font-size: 64px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.9);
}

.ui-cover-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0) 40%);
  pointer-events: none;
}

.ui-cover-badges {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  z-index: 2;
}

.ui-tag {
  border-radius: 999px;
  padding: 5px 11px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.2;
  backdrop-filter: blur(6px);
}

.ui-tag--category {
  background: rgba(15, 13, 27, 0.72);
  color: #ffffff;
}

.ui-tag--limited {
  background: #ffb020;
  color: #1a1203;
  margin-left: auto;
}

.ui-tag--soldout {
  background: rgba(240, 240, 245, 0.95);
  color: #1f1f2e;
  margin-left: auto;
}

.ui-card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px 18px;
  flex: 1;
}

.ui-card-date {
  color: var(--brand);
  font-weight: 800;
  font-size: var(--fs-card-meta, 13px);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ui-card-title {
  margin: 0;
  font-size: var(--fs-card-title, 17px);
  line-height: 1.25;
  font-weight: 800;
  color: var(--text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ui-card-place {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-card-meta, 13px);
  color: var(--text-secondary);
}

.ui-card-place span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-card-bottom {
  margin-top: auto;
  padding-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ui-card-price {
  font-size: var(--fs-price, 16px);
  font-weight: 800;
  color: var(--text-primary);
}

.ui-card-price.is-free {
  color: #12a372;
}

.ui-card-arrow {
  color: var(--text-secondary);
  transition: transform 0.2s ease, color 0.2s ease;
}

.ui-card:hover .ui-card-arrow {
  transform: translateX(3px);
  color: var(--brand);
}

@media (prefers-reduced-motion: reduce) {
  .ui-card,
  .ui-cover img,
  .ui-card-arrow {
    transition: none;
  }
  .ui-card:hover,
  .ui-card:hover .ui-cover img {
    transform: none;
  }
}
</style>
