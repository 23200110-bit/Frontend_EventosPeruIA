<script setup>
import { date, money } from '@/utils/formatters'

defineProps({
  event: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    default: 0
  }
})
</script>

<template>
  <router-link :to="'/evento/' + event.id" class="event-card">
    <div class="event-cover" :class="'cover-' + (index % 4)">
      <span>{{ event.category }}</span>
      <strong>{{ event.name.slice(0, 1) }}</strong>
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