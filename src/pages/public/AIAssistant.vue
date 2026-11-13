<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { chatService } from '@/services/chatService'
import { chatState, resetChat } from '@/stores/chatStore'
import { date, money } from '@/utils/formatters'

const latest = ref(null)
const suggestions = [
  { icon: 'location_on', text: '¿Qué eventos hay en Lima?' },
  { icon: 'music_note', text: '¿Qué conciertos están disponibles?' },
  { icon: 'local_activity', text: '¿Hay eventos gratuitos en Lima?' }
]

async function scrollToLatest() {
  await nextTick()
  const messages = latest.value?.parentElement
  if (messages) messages.scrollTop = messages.scrollHeight
}

onMounted(scrollToLatest)

async function send(value = chatState.value.draft) {
  const state = chatState.value
  const mensaje = value.trim()
  if (state.pending || !mensaje || mensaje.length > 2000) return

  state.error = ''
  state.draft = ''
  state.turns.push({ role: 'user', text: mensaje })
  state.pending = true
  void scrollToLatest()

  try {
    const result = await chatService.sendMessage({
      mensaje,
      conversacionId: state.id
    })
    if (chatState.value !== state) return
    state.id = result.conversacionId
    state.turns.push({ role: 'assistant', text: result.respuesta, events: result.eventos })
  } catch (error) {
    if (chatState.value !== state) return
    state.turns.pop()
    state.draft = mensaje
    state.error = error.message
  } finally {
    state.pending = false
    if (chatState.value === state) void scrollToLatest()
  }
}
</script>

<template>
  <q-page class="container assistant-page">
    <header class="assistant-header">
      <div class="assistant-avatar"><q-icon name="auto_awesome" size="26px" /></div>
      <div>
        <div class="eyebrow">ENCUENTRA TU PRÓXIMO PLAN</div>
        <h1>Asistente IA</h1>
        <p>Eventos, cupos y presupuestos en una conversación.</p>
      </div>
      <q-btn
        outline
        color="primary"
        no-caps
        icon="add"
        label="Nueva conversación"
        :disable="!chatState.turns.length && !chatState.draft"
        @click="resetChat"
      />
    </header>

    <section class="assistant-panel" aria-label="Chat de eventos">
      <div class="assistant-messages" role="log" aria-label="Mensajes" aria-live="polite">
        <div class="assistant-turn assistant-turn--bot">
          <div class="assistant-bubble">
            ¡Hola! Puedo ayudarte a buscar eventos del catálogo, consultar sus cupos o calcular
            cuánto gastarían en entradas.
          </div>
        </div>
        <article
          v-for="(turn, index) in chatState.turns"
          :key="index"
          :class="[
            'assistant-turn',
            turn.role === 'user' ? 'assistant-turn--user' : 'assistant-turn--bot'
          ]"
        >
          <span class="assistant-speaker">{{ turn.role === 'user' ? 'Tú' : 'Asistente IA' }}</span>
          <div class="assistant-bubble">{{ turn.text }}</div>
          <div v-if="turn.events?.length" class="assistant-events">
            <router-link
              v-for="event in turn.events"
              :key="event.eventoId"
              :to="'/evento/' + event.eventoId"
              class="assistant-event"
            >
              <q-icon name="confirmation_number" size="22px" color="primary" />
              <div>
                <small>{{ event.categoria }} · {{ date(event.fechaInicio) }}</small>
                <strong>{{ event.nombre }}</strong>
                <span
                  >{{ event.precio === 0 ? 'Gratis' : money(event.precio, event.moneda) }} ·
                  {{ event.cuposDisponibles }} cupos</span
                >
              </div>
              <q-icon name="chevron_right" size="20px" color="primary" />
            </router-link>
          </div>
        </article>
        <div v-if="chatState.pending" class="assistant-loading" role="status">
          <q-spinner color="primary" /> Consultando el catálogo…
        </div>
        <div ref="latest" />
      </div>
      <div class="assistant-compose">
        <div v-if="!chatState.turns.length" class="assistant-suggestions">
          <q-btn
            v-for="item in suggestions"
            :key="item.text"
            outline
            color="primary"
            no-caps
            :icon="item.icon"
            :label="item.text"
            :disable="chatState.pending"
            @click="send(item.text)"
          />
        </div>
        <q-banner v-if="chatState.error" class="error" role="alert">{{ chatState.error }}</q-banner>
        <q-form class="assistant-form" @submit="send()">
          <q-input
            v-model="chatState.draft"
            outlined
            label="Pregunta sobre un evento"
            maxlength="2000"
            :disable="chatState.pending"
          />
          <q-btn
            type="submit"
            unelevated
            color="primary"
            no-caps
            icon="send"
            label="Enviar"
            :loading="chatState.pending"
            :disable="!chatState.draft.trim()"
          />
        </q-form>
      </div>
    </section>
  </q-page>
</template>