import { computed, reactive } from 'vue'
import { ticketService } from '@/services/ticketService'
import { normalizeTicketStatus } from '@/utils/ticketHelpers'

const state = reactive({
  items: [],
  busy: false,
  error: '',
  activeTab: 'todas',
  selectedVoucher: null,
  loadingVoucherId: ''
})

const counts = computed(() => {
  const todas = state.items.length
  const validas = state.items.filter((t) => normalizeTicketStatus(t.estado) === 'valida').length
  const utilizadas = state.items.filter((t) => normalizeTicketStatus(t.estado) === 'utilizada').length
  const canceladas = state.items.filter((t) => normalizeTicketStatus(t.estado) === 'anulada').length
  return { todas, validas, utilizadas, canceladas }
})

const filteredItems = computed(() => {
  if (state.activeTab === 'todas') return state.items
  if (state.activeTab === 'validas') {
    return state.items.filter((t) => normalizeTicketStatus(t.estado) === 'valida')
  }
  if (state.activeTab === 'utilizadas') {
    return state.items.filter((t) => normalizeTicketStatus(t.estado) === 'utilizada')
  }
  return state.items.filter((t) => normalizeTicketStatus(t.estado) === 'anulada')
})

async function fetchMyTickets() {
  state.busy = true
  state.error = ''
  try {
    state.items = await ticketService.getMyTickets()
  } catch (e) {
    state.error = e.message || 'No se pudieron cargar tus entradas.'
  } finally {
    state.busy = false
  }
}

async function openVoucher(ticket) {
  state.error = ''
  state.loadingVoucherId = ticket.entradaId
  try {
    state.selectedVoucher = await ticketService.getVoucher(ticket.entradaId)
  } catch (e) {
    if (e?.status === 403 || e?.status === 404) {
      state.error = e.message || 'No tienes permisos para consultar este voucher.'
      state.selectedVoucher = null
    } else {
      state.selectedVoucher = ticket
    }
  } finally {
    state.loadingVoucherId = ''
  }
}

function closeVoucher() {
  state.selectedVoucher = null
}

function setTab(tab) {
  state.activeTab = tab
}

export function useTicketStore() {
  return {
    state,
    counts,
    filteredItems,
    fetchMyTickets,
    openVoucher,
    closeVoucher,
    setTab
  }
}