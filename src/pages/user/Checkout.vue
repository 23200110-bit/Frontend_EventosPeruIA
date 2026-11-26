<script setup>
// US-010: compra de entradas y control de aforo
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { eventService } from '@/services/eventService'
import { purchaseService } from '@/services/purchaseService'
import { session } from '@/stores/authStore'
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

const buyerName = computed(
  () => session.user?.nombre || session.user?.name || session.user?.email || 'Asistente registrado'
)
const buyerEmail = computed(() => session.user?.email || session.user?.correo || '')

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

const eventImage = computed(() => event.value?.imageUrl || event.value?.imagenUrl || '')

const quantityErrorMessage = computed(() => {
  const number = Number(quantity.value)
  if (!Number.isInteger(number) || number < 1) return 'Elige al menos una entrada.'
  if (number > available.value) return 'Solo quedan ' + available.value + ' cupos disponibles.'
  if (number > MAX_PER_ORDER) return 'El máximo por compra es ' + MAX_PER_ORDER + '.'
  return ''
})

function decrement() {
  const current = Number(quantity.value) || 1
  if (current > 1) quantity.value = current - 1
}

function increment() {
  const current = Number(quantity.value) || 0
  if (current < maxQuantity.value) quantity.value = current + 1
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
  <q-page class="container checkout-page">
    <router-link :to="'/evento/' + route.params.id" class="back-link">
      ← Volver al detalle del evento
    </router-link>

    <div v-if="busy" class="empty">
      <q-spinner color="primary" size="28px" />
      <p>Preparando tu orden…</p>
    </div>

    <q-banner v-if="!busy && !event" class="error" role="alert">
      {{ error || 'No se encontró el evento.' }}
    </q-banner>

    <template v-if="event">
      <!-- Encabezado de página -->
      <header class="checkout-header">
        <div class="eyebrow">CHECKOUT · COMPRA SEGURA</div>
        <h1 class="page-heading checkout-header__title">{{ event.name }}</h1>
        <div class="checkout-header__meta">
          <span>
            <q-icon name="event" size="16px" color="primary" />
            {{ date(event.startDate) }}
          </span>
          <span>
            <q-icon name="place" size="16px" color="primary" />
            {{ event.venue || event.address }}, {{ event.city }}
          </span>
        </div>
      </header>

      <!-- Vista de Confirmación Exitosa -->
      <section v-if="purchase" class="surface confirmation-card" role="status">
        <div class="confirmation-card__badge">
          <q-icon name="check_circle" size="34px" color="positive" />
        </div>
        <div class="eyebrow" style="margin-bottom: 6px;">ORDEN COMPLETADA</div>
        <h2 class="confirmation-card__title">¡Tus entradas están listas!</h2>
        <p class="confirmation-card__sub">
          Confirmamos <strong>{{ purchase.cantidad }}</strong>
          {{ purchase.cantidad === 1 ? 'entrada' : 'entradas' }} por un total de
          <strong>{{ money(purchase.montoTotal, purchase.moneda) }}</strong>.
        </p>

        <div class="issued-tickets">
          <div class="issued-tickets__header">
            <span>Códigos de acceso emitidos</span>
            <small>Disponibles en tu billetera con QR</small>
          </div>
          <div class="issued-tickets__grid">
            <div
              v-for="ticket in purchase.entradas"
              :key="ticket.entradaId"
              class="issued-ticket-pill"
            >
              <q-icon name="confirmation_number" color="primary" size="18px" />
              <span>{{ ticket.codigoCorto }}</span>
            </div>
          </div>
        </div>

        <p class="muted" style="font-size: 13px; margin: 16px 0 24px;">
          Aún quedan <strong>{{ available }}</strong> cupos disponibles para este evento.
        </p>

        <div class="confirmation-card__actions">
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="qr_code_2"
            label="Ver mis entradas y QR"
            class="pill-btn"
            to="/entradas"
          />
          <q-btn
            v-if="onSale && available > 0"
            outline
            no-caps
            color="primary"
            label="Comprar más entradas"
            class="pill-btn"
            @click="buyMore"
          />
        </div>
      </section>

      <!-- Flujo Principal de Compra a 2 Columnas -->
      <div v-else class="checkout-layout">
        <!-- Columna Izquierda: Configuración de entradas y datos -->
        <div class="checkout-main">
          <q-banner v-if="cancelled" class="error" role="alert">
            Este evento fue cancelado. No es posible comprar entradas.
          </q-banner>
          <q-banner v-else-if="!onSale" class="error" role="alert">
            Este evento ya no está disponible para la venta.
          </q-banner>
          <q-banner v-else-if="available === 0" class="error" role="alert">
            Evento agotado. Ya no quedan cupos disponibles.
          </q-banner>

          <template v-if="onSale && available > 0">
            <!-- Paso 1: Selección de cantidad -->
            <section class="surface checkout-card">
              <div class="checkout-card__head">
                <span class="step-badge">1</span>
                <div>
                  <h2 class="checkout-card__title">Selecciona tus entradas</h2>
                  <p class="muted checkout-card__sub">
                    <strong>{{ available }}</strong> cupos disponibles en tiempo real · máximo
                    {{ maxQuantity }} por orden
                  </p>
                </div>
              </div>

              <div class="ticket-selector">
                <div class="ticket-selector__info">
                  <div class="ticket-selector__type">Entrada General</div>
                  <div class="ticket-selector__price">
                    {{ unitPrice === 0 ? 'Gratis' : money(unitPrice, event.currency) }}
                    <span class="muted">c/u</span>
                  </div>
                </div>

                <div class="stepper" role="group" aria-label="Cantidad de entradas">
                  <q-btn
                    flat
                    round
                    dense
                    icon="remove"
                    class="stepper__btn"
                    :disable="quantity <= 1 || buying"
                    aria-label="Disminuir cantidad"
                    @click="decrement"
                  />
                  <input
                    v-model.number="quantity"
                    type="number"
                    min="1"
                    :max="maxQuantity"
                    class="stepper__input"
                    aria-label="Número de entradas"
                  />
                  <q-btn
                    flat
                    round
                    dense
                    icon="add"
                    class="stepper__btn"
                    :disable="quantity >= maxQuantity || buying"
                    aria-label="Aumentar cantidad"
                    @click="increment"
                  />
                </div>
              </div>

              <p v-if="quantityErrorMessage" class="field-error" role="alert">
                {{ quantityErrorMessage }}
              </p>
            </section>

            <!-- Paso 2: Titular de la compra -->
            <section class="surface checkout-card">
              <div class="checkout-card__head">
                <span class="step-badge">2</span>
                <div>
                  <h2 class="checkout-card__title">Titular de las entradas</h2>
                  <p class="muted checkout-card__sub">
                    Tus entradas digitales se emitirán asociadas a tu cuenta activa
                  </p>
                </div>
              </div>

              <div class="buyer-box">
                <div class="buyer-box__avatar">
                  <q-icon name="person" size="22px" color="primary" />
                </div>
                <div class="buyer-box__details">
                  <strong>{{ buyerName }}</strong>
                  <span v-if="buyerEmail" class="muted">{{ buyerEmail }}</span>
                </div>
                <q-badge color="positive" outline label="Cuenta verificada" />
              </div>

              <div class="perks-row">
                <div class="perk-item">
                  <q-icon name="qr_code_2" color="primary" size="18px" />
                  <span>Código QR único anti-fraude por entrada</span>
                </div>
                <div class="perk-item">
                  <q-icon name="bolt" color="primary" size="18px" />
                  <span>Entrega inmediata en «Mis entradas»</span>
                </div>
              </div>
            </section>
          </template>

          <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>
          <q-banner v-if="notice" class="success" role="status">{{ notice }}</q-banner>
        </div>

        <!-- Columna Derecha: Resumen de Orden Sticky -->
        <aside v-if="onSale && available > 0" class="checkout-sidebar">
          <div class="surface summary-card">
            <div class="summary-card__media">
              <img
                v-if="eventImage"
                :src="eventImage"
                :alt="event.name"
                class="summary-card__img"
              />
              <div v-else class="summary-card__placeholder">
                <q-icon name="confirmation_number" size="36px" color="white" />
              </div>
              <span class="summary-card__cat">{{ event.category || 'Evento' }}</span>
            </div>

            <div class="summary-card__body">
              <div class="eyebrow" style="margin-bottom: 4px;">RESUMEN DE TU ORDEN</div>
              <h3 class="summary-card__event">{{ event.name }}</h3>

              <div class="summary-rows">
                <div class="summary-row">
                  <span class="muted">Tipo de entrada</span>
                  <span>Entrada General</span>
                </div>
                <div class="summary-row">
                  <span class="muted">Precio unitario</span>
                  <span>{{ unitPrice === 0 ? 'Gratis' : money(unitPrice, event.currency) }}</span>
                </div>
                <div class="summary-row">
                  <span class="muted">Cantidad</span>
                  <span>× {{ validQuantity ? quantity : 0 }}</span>
                </div>
                <div class="summary-row">
                  <span class="muted">Cargo por servicio</span>
                  <span class="text-positive text-weight-medium">Incluido</span>
                </div>
              </div>

              <div class="summary-total">
                <span>Total a pagar</span>
                <strong>{{ validQuantity ? money(total, event.currency) : '—' }}</strong>
              </div>

              <q-btn
                unelevated
                no-caps
                color="primary"
                icon="lock"
                label="Confirmar compra"
                class="full-width summary-cta"
                :loading="buying"
                :disable="!canBuy"
                @click="confirm"
              />

              <p class="summary-footnote">
                <q-icon name="verified_user" size="14px" />
                La disponibilidad se reserva atómicamente en el servidor al confirmar.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </template>
  </q-page>
</template>

<style scoped>
.checkout-page {
  padding-bottom: 56px;
}

.checkout-header {
  margin-bottom: 28px;
}

.checkout-header__title {
  margin: 4px 0 10px;
}

.checkout-header__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  font-size: 14px;
  color: var(--muted-ink);
}

.checkout-header__meta span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Grid 2 Columnas */
.checkout-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 1fr);
  gap: 24px;
  align-items: start;
}

.checkout-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.checkout-card {
  padding: 24px;
}

.checkout-card__head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 20px;
}

.step-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary, #5138b9);
  color: #ffffff;
  font-size: 13px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.checkout-card__title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--ink);
}

.checkout-card__sub {
  margin: 0;
  font-size: 13.5px;
}

/* Selector tipo caja de entrada */
.ticket-selector {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  border: 1.5px solid var(--line);
  border-radius: 14px;
  background: var(--wash, #faf9fc);
}

.ticket-selector__type {
  font-weight: 700;
  font-size: 15px;
  color: var(--ink);
}

.ticket-selector__price {
  font-size: 18px;
  font-weight: 800;
  color: var(--primary, #5138b9);
  margin-top: 2px;
}

.ticket-selector__price span {
  font-size: 12.5px;
  font-weight: 500;
}

.stepper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px 6px;
}

.stepper__btn {
  color: var(--ink);
}

.stepper__input {
  width: 44px;
  text-align: center;
  border: none;
  background: transparent;
  font-size: 16px;
  font-weight: 800;
  color: var(--ink);
  outline: none;
  -moz-appearance: textfield;
}

.stepper__input::-webkit-outer-spin-button,
.stepper__input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.field-error {
  color: #c10015;
  font-size: 13px;
  font-weight: 600;
  margin: 10px 0 0;
}

/* Titular y garantías */
.buyer-box {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: #ffffff;
}

.buyer-box__avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #f0ecfb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.buyer-box__details {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.buyer-box__details strong {
  font-size: 14.5px;
  color: var(--ink);
}

.buyer-box__details span {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.perks-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.perk-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted-ink);
  background: var(--wash, #faf9fc);
  padding: 10px 12px;
  border-radius: 10px;
}

/* Tarjeta Resumen Derecha */
.checkout-sidebar {
  position: sticky;
  top: 88px;
}

.summary-card {
  padding: 0;
  overflow: hidden;
}

.summary-card__media {
  position: relative;
  height: 136px;
  background: linear-gradient(135deg, #271a6b 0%, #5138b9 100%);
}

.summary-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.summary-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.summary-card__cat {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(18, 14, 38, 0.78);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 999px;
}

.summary-card__body {
  padding: 22px;
}

.summary-card__event {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0 0 18px;
  color: var(--ink);
}

.summary-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 16px;
  border-bottom: 1px dashed var(--line);
  font-size: 14px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.summary-total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 16px 0 20px;
}

.summary-total span {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}

.summary-total strong {
  font-size: 26px;
  font-weight: 800;
  color: var(--ink);
}

.summary-cta {
  border-radius: 999px;
  padding: 12px 20px;
  font-weight: 700;
  font-size: 15px;
}

.summary-footnote {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  font-size: 12px;
  color: var(--muted-ink);
  margin: 12px 0 0;
}

/* Confirmación */
.confirmation-card {
  max-width: 640px;
  margin: 0 auto;
  padding: 36px 32px;
  text-align: center;
}

.confirmation-card__badge {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #e6f8ee;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.confirmation-card__title {
  font-size: 24px;
  font-weight: 800;
  margin: 0 0 8px;
  color: var(--ink);
}

.confirmation-card__sub {
  font-size: 15px;
  color: var(--muted-ink);
  margin: 0 0 22px;
}

.issued-tickets {
  background: var(--wash, #faf9fc);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px;
  text-align: left;
}

.issued-tickets__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
}

.issued-tickets__header small {
  color: var(--muted-ink);
  font-weight: 500;
}

.issued-tickets__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.issued-ticket-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  border: 1px solid var(--line);
  padding: 6px 12px;
  border-radius: 999px;
  font-family: monospace;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--ink);
}

.confirmation-card__actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
}

.pill-btn {
  border-radius: 999px;
  padding: 10px 22px;
  font-weight: 700;
}

@media (max-width: 860px) {
  .checkout-layout {
    grid-template-columns: 1fr;
  }

  .checkout-sidebar {
    position: static;
  }
}
</style>