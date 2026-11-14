<script setup>
import { onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import TicketQrModal from '@/components/tickets/TicketQrModal.vue'
import { ticketService } from '@/services/ticketService'
import { date, money } from '@/utils/formatters'

const items = ref([])
const busy = ref(true)
const error = ref('')
const qr = ref('')

async function load() {
  busy.value = true
  try {
    items.value = await ticketService.getMyTickets()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function showQR(ticket) {
  error.value = ''
  try {
    qr.value = await QRCode.toDataURL(ticket.ticketId, { width: 260, margin: 2 })
  } catch {
    error.value = 'No se pudo generar el QR.'
  }
}

onMounted(load)
</script>

<template>
  <q-page class="container">
    <div class="eyebrow">TU CUENTA</div>
    <h1 class="page-heading">Mis entradas</h1>
    <p>Tus vouchers y el estado de cada entrada.</p>

    <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>
    <div v-if="busy" class="empty"><q-spinner /> Cargando…</div>
    <div v-else-if="!items.length && !error" class="empty">
      Todavía no tienes entradas registradas.
    </div>

    <div class="personal-list">
      <article v-for="item in items" :key="item.ticketId" class="surface">
        <q-badge :color="item.status === 'Válida' ? 'primary' : 'grey'">{{ item.status }}</q-badge>
        <h3>{{ item.event }}</h3>
        <p>{{ date(item.startDate) }} · {{ item.city }}</p>
        <p>{{ item.venue }} · {{ item.address }}</p>
        <p>Titular: {{ item.holder }} · {{ money(item.price, item.currency) }}</p>
        <small>Referencia: {{ item.shortCode }}</small>
        <p v-if="item.refundStatus === 'Pendiente'">
          Pendiente de reembolso · {{ item.cancellationReason }}
        </p>
        <q-btn
            no-caps
            outline
            color="primary"
            label="Mostrar QR"
            :disable="(item.status !== 'Valida' && item.status !== 'Válida') || item.eventStatus === 'Cancelado'"
            @click="showQR(item)"
          />
        <router-link :to="'/evento/' + item.eventId">Ver evento</router-link>
      </article>
    </div>

    <TicketQrModal :qr="qr" @close="qr = ''" />
  </q-page>
</template>