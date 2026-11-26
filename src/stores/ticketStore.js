import { computed, reactive, watch } from 'vue'
import { ticketService } from '@/services/ticketService'
import { session } from '@/stores/authStore'
import { normalizeTicketStatus } from '@/utils/ticketHelpers'

const createInitialState = () => ({
  items: [],
  busy: false,
  error: '',
  activeTab: 'todas',
  selectedVoucher: null,
  loadingVoucherId: ''
})

const state = reactive(createInitialState())
let activeTicketsRequest = null
let activeVoucherRequest = null

watch(
  () => session.token,
  () => {
    activeTicketsRequest = null
    activeVoucherRequest = null
    Object.assign(state, createInitialState())
  },
  { flush: 'sync' }
)

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
  if (!session.token) return

  const request = Symbol()
  activeTicketsRequest = request
  state.busy = true
  state.error = ''

  try {
    const items = await ticketService.getMyTickets()
    if (activeTicketsRequest !== request) return
    state.items = items
  } catch (e) {
    if (activeTicketsRequest !== request) return
    state.error = e.message || 'No se pudieron cargar tus entradas.'
  } finally {
    if (activeTicketsRequest === request) state.busy = false
  }
}

async function openVoucher(ticket) {
  if (!session.token) return

  const request = Symbol()
  activeVoucherRequest = request
  state.error = ''
  state.loadingVoucherId = ticket.entradaId

  try {
    const voucher = await ticketService.getVoucher(ticket.entradaId)
    if (activeVoucherRequest !== request) return
    state.selectedVoucher = voucher
  } catch (e) {
    if (activeVoucherRequest !== request) return
    if (e?.status === 403 || e?.status === 404) {
      state.error = e.message || 'No tienes permisos para consultar este voucher.'
      state.selectedVoucher = null
    } else {
      state.selectedVoucher = ticket
    }
  } finally {
    if (activeVoucherRequest === request) state.loadingVoucherId = ''
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
