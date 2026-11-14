<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { eventService } from '@/services/eventService'
import { session } from '@/stores/authStore'
import { date } from '@/utils/formatters'

const router = useRouter()
const events = ref([])
const busy = ref(true)
const error = ref('')

// Filtra ESTRICTAMENTE los eventos organizados por el usuario autenticado
const organizerEvents = computed(() => {
  const myName = `${session.user?.firstName || ''} ${session.user?.lastName || ''}`
    .trim()
    .toLowerCase()
  const myId = session.user?.userId || session.user?.id

  if (!myName && !myId) return []

  return events.value.filter(
    e =>
      (myId && e.organizerId === myId) ||
      (myName && (e.organizer || '').trim().toLowerCase() === myName)
  )
})

async function load() {
  busy.value = true
  error.value = ''
  try {
    const res = await eventService.searchEvents({ page: 1, pageSize: 50 })
    events.value = Array.isArray(res) ? res : res?.items || []
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

function goToCheckIn(eventItem) {
  router.push({
    path: `/organizador/checkin/${eventItem.id}`,
    query: { name: eventItem.name }
  })
}

onMounted(load)
</script>

<template>
  <q-page class="container">
    <div class="eyebrow">PANEL DE ORGANIZADOR · HU-12</div>
    <h1 class="page-heading">Gestión de asistentes</h1>
    <p class="detail-description">
      Selecciona uno de tus eventos organizados para monitorear el ingreso y abrir el escáner de Check-in QR.
    </p>

    <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>
    <div v-if="busy" class="empty"><q-spinner /> Verificando tus eventos organizados…</div>

    <template v-else>
      <div v-if="!organizerEvents.length" class="empty">
        No tienes eventos organizados asignados a tu cuenta ({{ session.user?.firstName }} {{ session.user?.lastName }}).
        Solo el organizador propietario puede acceder al Check-in de su evento.
      </div>

      <div v-else class="personal-list">
        <article v-for="ev in organizerEvents" :key="ev.id" class="surface">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div>
              <q-badge color="primary">{{ ev.status || 'Publicado' }}</q-badge>
              <h3 style="margin: 8px 0 4px;">{{ ev.name }}</h3>
              <p class="muted" style="margin: 0;">
                {{ date(ev.startDate) }} · {{ ev.venue || ev.city }}
              </p>
              <p style="margin: 6px 0 0;">
                <strong>Aforo total:</strong> {{ ev.capacity }} ·
                <strong>Cupos disponibles:</strong> {{ ev.availableSpots }}
              </p>
            </div>

            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="qr_code_scanner"
              label="Abrir Check-in QR"
              @click="goToCheckIn(ev)"
            />
          </div>
        </article>
      </div>
    </template>
  </q-page>
</template>