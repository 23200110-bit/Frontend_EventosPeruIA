<script setup>
import { onMounted, ref } from 'vue'
import { eventService } from '@/services/eventService'
import { date, money } from '@/utils/formatters'

const items = ref([])
const busy = ref(true)
const error = ref('')

async function load() {
  busy.value = true
  error.value = ''
  try {
    items.value = await eventService.getRecommendations(20)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <q-page class="container">
    <div class="eyebrow">HECHO PARA TI</div>
    <h1 class="page-heading">Tu próxima experiencia</h1>
    <p>Recomendaciones según tus intereses, ubicación y actividad disponible.</p>

    <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>
    <div v-if="busy" class="empty"><q-spinner /> Cargando recomendaciones…</div>

    <div v-else-if="!items.length && !error" class="empty">
      Aún no hay recomendaciones disponibles.
      <router-link to="/perfil">Configura tus intereses</router-link>.
    </div>

    <div v-else class="event-grid">
      <router-link
        v-for="(item, index) in items"
        :key="item.eventId"
        :to="'/evento/' + item.eventId"
        class="event-card"
      >
        <div class="event-cover" :class="'cover-' + (index % 4)">
          <span>{{ item.category }}</span>
          <strong>✳</strong>
        </div>
        <div class="event-info">
          <small>{{ date(item.startDate) }}</small>
          <h3>{{ item.name }}</h3>
          <p>{{ item.city }}</p>
          <strong>{{ money(item.price, item.currency) }}</strong>
          <p class="reason">{{ item.reason }}</p>
        </div>
      </router-link>
    </div>
  </q-page>
</template>