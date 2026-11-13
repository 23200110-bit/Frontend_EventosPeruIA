<script setup>
import { onMounted, ref } from 'vue'
import { userService } from '@/services/userService'
import { date } from '@/utils/formatters'

const items = ref([])
const busy = ref(true)
const error = ref('')

async function load() {
  busy.value = true
  try {
    items.value = await userService.getNotifications()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function mark(item) {
  try {
    await userService.markNotificationRead(item.id)
    item.read = true
  } catch (e) {
    error.value = e.message
  }
}

onMounted(load)
</script>

<template>
  <q-page class="container">
    <div class="eyebrow">TU CUENTA</div>
    <h1 class="page-heading">Tus notificaciones</h1>
    <p>Novedades sobre tus eventos, en un solo lugar.</p>

    <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>
    <div v-if="busy" class="empty"><q-spinner /> Cargando…</div>
    <div v-else-if="!items.length && !error" class="empty">No tienes notificaciones.</div>

    <div class="personal-list">
      <article v-for="item in items" :key="item.id" class="surface">
        <q-badge v-if="!item.read" color="secondary">Nueva</q-badge>
        <h3>{{ item.title }}</h3>
        <p>{{ item.message }}</p>
        <small>{{ date(item.createdAt) }}</small>
        <q-btn v-if="!item.read" flat no-caps label="Marcar como leída" @click="mark(item)" />
      </article>
    </div>
  </q-page>
</template>