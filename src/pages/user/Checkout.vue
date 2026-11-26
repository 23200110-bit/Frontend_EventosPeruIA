<script setup>
// US-010: compra de entradas y control de aforo
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { eventService } from '@/services/eventService'
import { purchaseService } from '@/services/purchaseService'
import { date, money } from '@/utils/formatters'

const MAX_PER_ORDER = 10

const route = useRoute()
const event = ref(null)
const quantity = ref(1)
const busy = ref(true)
const buying = ref(false)
const error = ref('')
const notice = ref('')
const purchase = ref(null)
let requestId = ''
let timer = null

const cancelled = computed(() => event.value?.status === 'Cancelado')
const onSale = computed(
  () => event.value?.status === 'Publicado' && new Date(event.value.startDate) > new Date()
)
const available = computed(() => Math.max(0, event.value?.availableSpots || 0))
const maxQuantity = computed(() => Math.min(available.value, MAX_PER_ORDER))
const unitPrice = computed(() => event.value?.price || 0)
const total = computed(() => unitPrice.value * (Number(quantity.value) || 0))
const validQuantity = computed(() => {
  const value = Number(quantity.value)
  return Number.isInteger(value) && value >= 1 && value <= maxQuantity.value
})
const canBuy = computed(() => onSale.value && validQuantity.value && !buying.value)

const quantityRule = (value) => {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) return 'Elige al menos una entrada.'
  if (number > available.value) return 'Solo quedan ' + available.value + ' cupos disponibles.'
  if (number > MAX_PER_ORDER) return 'El máximo por compra es ' + MAX_PER_ORDER + '.'
  return true
}

// Un identificador por intento de compra: si la red falla y se reintenta, el servidor no duplica la compra.
function newRequestId() {
  requestId = crypto.randomUUID()
}

async function refresh() {
  try {
    event.value = await eventService.getEventById(route.params.id)
    return true
  } catch {
    return false
  }
}

async function load() {
  busy.value = true
  try {
    event.value = await eventService.getEventById(route.params.id)
  } catch (failure) {
    error.value = failure.message
  } finally {
    busy.value = false
  }
}

async function confirm() {
  if (!canBuy.value) return
  buying.value = true
  error.value = ''
  notice.value = ''
  const asked = Number(quantity.value)
  try {
    purchase.value = await purchaseService.buy({
      eventId: route.params.id,
      quantity: asked,
      requestId
    })
    newRequestId()
    quantity.value = 1
    // El aforo nuevo se muestra sin recargar la página.
    await refresh()
  } catch (failure) {
    error.value = failure.message
    // La compra fue rechazada: se informa la disponibilidad actual.
    await refresh()
    if (cancelled.value) {
      notice.value = 'El evento fue cancelado y ya no está disponible.'
    } else if (available.value === 0) {
      notice.value = 'Las entradas se agotaron mientras confirmabas.'
    } else if (available.value < asked) {
      notice.value = 'Ahora quedan ' + available.value + ' cupos. Ajustamos la cantidad.'
      quantity.value = Math.min(available.value, MAX_PER_ORDER)
    }
  } finally {
    buying.value = false
  }
}

function buyMore() {
  purchase.value = null
  error.value = ''
  notice.value = ''
}

watch(quantity, newRequestId)

onMounted(async () => {
  newRequestId()
  await load()
  timer = setInterval(() => {
    if (document.visibilityState === 'visible' && !buying.value) refresh()
  }, 15000)
})

onBeforeUnmount(() => {
  clearInterval(timer)
})
</script>

<template>
  <q-page class="container">
    <router-link :to="'/evento/' + route.params.id" class="back-link">← Volver al evento</router-link>

    <div v-if="busy" class="empty"><q-spinner /> Cargando evento…</div>
    <q-banner v-if="!busy && !event" class="error" role="alert">
      {{ error || 'No se encontró el evento.' }}
    </q-banner>

    <template v-if="event">
      <div class="eyebrow">COMPRA DE ENTRADAS</div>
      <h1 class="page-heading">{{ event.name }}</h1>
      <p class="muted">{{ date(event.startDate) }} · {{ event.venue || event.address }}, {{ event.city }}</p>

      <section v-if="purchase" class="surface form-stack" role="status">
        <h2>¡Compra confirmada!</h2>
        <p>
          Compraste <strong>{{ purchase.cantidad }}</strong>
          {{ purchase.cantidad === 1 ? 'entrada' : 'entradas' }} por
          <strong>{{ money(purchase.montoTotal, purchase.moneda) }}</strong>.
        </p>
        <ul>
          <li v-for="ticket in purchase.entradas" :key="ticket.entradaId">
            Entrada <strong>{{ ticket.codigoCorto }}</strong>
          </li>
        </ul>
        <p class="muted">Quedan {{ available }} cupos disponibles para este evento.</p>
        <div class="row q-gutter-sm">
          <q-btn unelevated no-caps color="primary" label="Ver mis entradas" to="/entradas" />
          <q-btn
            v-if="onSale && available > 0"
            flat
            no-caps
            label="Comprar más entradas"
            @click="buyMore"
          />
        </div>
      </section>

      <section v-else class="surface form-stack">
        <q-banner v-if="cancelled" class="error" role="alert">
          Este evento fue cancelado. No es posible comprar entradas.
        </q-banner>
        <q-banner v-else-if="!onSale" class="error" role="alert">
          Este evento ya no está disponible para la venta.
        </q-banner>
        <q-banner v-else-if="available === 0" class="error" role="alert">Evento agotado.</q-banner>

        <template v-if="onSale && available > 0">
          <p>
            <strong>{{ available }}</strong> cupos disponibles · máximo {{ maxQuantity }} por compra
          </p>
          <q-input
            v-model.number="quantity"
            outlined
            type="number"
            label="Cantidad de entradas"
            min="1"
            :max="maxQuantity"
            :rules="[quantityRule]"
          />

          <h3 class="checkout-summary-title">Resumen de tu compra</h3>
          <q-markup-table flat bordered>
            <tbody>
              <tr>
                <td>Evento</td>
                <td class="text-right">{{ event.name }}</td>
              </tr>
              <tr>
                <td>Cantidad</td>
                <td class="text-right">{{ validQuantity ? quantity : '—' }}</td>
              </tr>
              <tr>
                <td>Precio unitario</td>
                <td class="text-right">
                  {{ unitPrice === 0 ? 'Gratis' : money(unitPrice, event.currency) }}
                </td>
              </tr>
              <tr>
                <td><strong>Total</strong></td>
                <td class="text-right">
                  <strong>{{ validQuantity ? money(total, event.currency) : '—' }}</strong>
                </td>
              </tr>
            </tbody>
          </q-markup-table>
        </template>

        <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>
        <q-banner v-if="notice" class="success" role="status">{{ notice }}</q-banner>

        <q-btn
          v-if="onSale && available > 0"
          unelevated
          no-caps
          color="primary"
          label="Confirmar compra"
          class="btn-buy"
          :loading="buying"
          :disable="!canBuy"
          @click="confirm"
        />
        <p class="muted">La disponibilidad se confirma en el servidor al momento de comprar.</p>
      </section>
    </template>
  </q-page>
</template>

<style scoped>
.checkout-summary-title {
  margin: 18px 0 8px;
  font-size: 20px;
  line-height: 1.3;
  font-weight: 800;
  color: var(--text-primary);
}
</style>
