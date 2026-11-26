<script setup>
import { onMounted } from 'vue'
import TicketCard from '@/components/tickets/TicketCard.vue'
import TicketQrModal from '@/components/tickets/TicketQrModal.vue'
import { useTicketStore } from '@/stores/ticketStore'

const { state, counts, filteredItems, fetchMyTickets, openVoucher, closeVoucher, setTab } =
  useTicketStore()

const tabs = [
  { key: 'todas', label: 'Todas' },
  { key: 'validas', label: 'Válidas' },
  { key: 'utilizadas', label: 'Utilizadas' },
  { key: 'canceladas', label: 'Canceladas' }
]

onMounted(() => {
  fetchMyTickets()
})
</script>

<template>
  <q-page class="container">
    <div class="tickets-topbar">
      <div>
        <div class="eyebrow">TU CUENTA</div>
        <h1 class="page-heading tickets-topbar__title">Mis entradas</h1>
        <p class="muted tickets-topbar__sub">
          {{ counts.todas }} {{ counts.todas === 1 ? 'entrada' : 'entradas' }} en total
        </p>
      </div>

      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="confirmation_number"
        label="Comprar más"
        class="tickets-topbar__cta"
        to="/explorar"
      />
    </div>

    <div class="tickets-filter-bar" role="tablist" aria-label="Filtrar entradas por estado">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        role="tab"
        tabindex="0"
        :aria-selected="state.activeTab === tab.key"
        class="tickets-pill"
        :class="{ 'tickets-pill--active': state.activeTab === tab.key }"
        @click="setTab(tab.key)"
        @keydown.enter.prevent="setTab(tab.key)"
      >
        {{ tab.label }} ({{ counts[tab.key] }})
      </div>
    </div>

    <q-banner v-if="state.error" class="error" role="alert">{{ state.error }}</q-banner>

    <div v-if="state.busy" class="empty">
      <q-spinner color="primary" size="28px" />
      <p>Cargando tus entradas…</p>
    </div>

    <div v-else-if="!filteredItems.length && !state.error" class="empty">
      <h3>No tienes entradas en esta categoría</h3>
      <p>Explora los próximos eventos publicados y asegura tu lugar.</p>
      <q-btn unelevated no-caps color="primary" label="Explorar eventos" to="/explorar" />
    </div>

    <div v-else class="tickets-list">
      <div v-for="item in filteredItems" :key="item.entradaId" class="tickets-list__item">
        <TicketCard
          :ticket="item"
          :loading="state.loadingVoucherId === item.entradaId"
          @select="openVoucher"
        />
      </div>
    </div>

    <TicketQrModal :ticket="state.selectedVoucher" @close="closeVoucher" />
  </q-page>
</template>

<style scoped>
.tickets-topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 28px;
}

.tickets-topbar__title {
  margin-bottom: 6px;
}

.tickets-topbar__sub {
  margin: 0;
  font-size: 14px;
}

.tickets-topbar__cta {
  border-radius: 999px;
  padding: 10px 22px;
  font-weight: 700;
  flex-shrink: 0;
}

.tickets-filter-bar {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  background: var(--wash);
  border: 1px solid var(--line);
  padding: 6px;
  border-radius: 999px;
  margin-bottom: 28px;
  max-width: 100%;
}

@media (max-width: 600px) {
  .tickets-filter-bar {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    border-radius: 18px;
  }
  .tickets-filter-bar::-webkit-scrollbar {
    display: none;
  }
  .tickets-pill {
    flex: 0 0 auto;
    white-space: nowrap;
  }
}

.tickets-pill {
  color: var(--muted-ink);
  font-size: 13.5px;
  font-weight: 700;
  padding: 8px 18px;
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.tickets-pill:hover {
  color: var(--ink);
}

.tickets-pill--active {
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: 0 2px 10px color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.tickets-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tickets-list__item {
  width: 100%;
}

@media (max-width: 640px) {
  .tickets-topbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>