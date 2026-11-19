<script setup>
import { ref, watch } from 'vue'
import { date, money } from '@/utils/formatters'

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

watch(() => props.event.imageUrl, () => {
  imageFailed.value = false
})
</script>

<template>
  <router-link :to="'/evento/' + event.id" class="event-card">
    <div class="event-cover" :class="'cover-' + (index % 4)">
      <img
        v-if="event.imageUrl && !imageFailed"
        :key="event.imageUrl"
        :src="event.imageUrl"
        alt=""
        loading="lazy"
        @error="imageFailed = true"
      />
      <strong v-else aria-hidden="true">{{ event.name.slice(0, 1) }}</strong>
      <span>{{ event.category }}</span>
    </div>

    <div class="event-info">
      <small>{{ date(event.startDate) }}</small>
      <h3>{{ event.name }}</h3>
      <p>{{ event.city }} · {{ event.venue || event.address }}</p>

      <div class="event-bottom">
        <strong>{{ event.price === 0 ? 'Gratis' : money(event.price, event.currency) }}</strong>
        <q-badge :color="event.availableSpots > 0 ? 'primary' : 'grey'">
          {{ event.availableSpots > 0 ? 'Ver evento' : 'Agotado' }}
        </q-badge>
      </div>
    </div>
  </router-link>
</template>

<style scoped>
.event-cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>