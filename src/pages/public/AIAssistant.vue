<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { chatService } from '@/services/chatService'
import { chatState, resetChat } from '@/stores/chatStore'
import { session } from '@/stores/authStore'
import { date, money } from '@/utils/formatters'

const latest = ref(null)
const agentMode = ref(false)
const isAdmin = computed(() => session.user?.isAdministrator === true)
const suggestions = [
  { icon: 'location_on', text: '¿Qué eventos hay en Lima?' },
  { icon: 'music_note', text: '¿Qué conciertos están disponibles?' },
  { icon: 'local_activity', text: '¿Hay eventos gratuitos en Lima?' }
]

watch(isAdmin, (allowed) => {
  if (!allowed) agentMode.value = false
})

async function scrollToLatest() {
  await nextTick()
  const messages = latest.value?.parentElement
  if (messages) messages.scrollTop = messages.scrollHeight
}

function sourceLabel(source, index) {
  if (typeof source === 'string') return source

  const metadata = source?.metadata || {}
  return (
    source?.title ||
    metadata.title ||
    source?.file_path ||
    source?.filePath ||
    metadata.file_path ||
    source?.path ||
    metadata.path ||
    source?.name ||
    metadata.name ||
    source?.source ||
    metadata.source ||
    `Fuente ${index + 1}`
  )
}

function actionLabel(action) {
  return String(action).replaceAll('_', ' ')
}

function patchStatusLabel(status) {
  if (status === 'pending') return 'Pruebas y compilación aprobadas; verificación local en curso'
  if (status === 'approved') return 'Reinicio y verificación local completados'
  if (status === 'rejected') return 'Rechazado; el backend restauró el archivo original'
  return status || 'Estado no informado'
}

function failureMessage(result) {
  const reason = result?.reason
  return reason?.message || (typeof reason === 'string' ? reason : '')
}

onMounted(scrollToLatest)

async function send(value = chatState.value.draft) {
  const state = chatState.value
  const mensaje = value.trim()
  const maxLength = agentMode.value && isAdmin.value ? 8000 : 2000
  if (state.pending || !mensaje || mensaje.length > maxLength) return

  state.error = ''
  state.draft = ''
  state.turns.push({ role: 'user', text: mensaje })
  state.pending = true
  void scrollToLatest()

  try {
    if (chatState.value !== state) return
    if (agentMode.value && isAdmin.value) {
      const result = await chatService.runAgent(mensaje)
      if (chatState.value !== state) return
      state.turns.push({
        role: 'assistant',
        mode: 'agent',
        text: result.reply,
        actions: Array.isArray(result.toolsExecuted) ? result.toolsExecuted : [],
        patch: result.proposedPatch || null
      })
    } else {
      const [catalogResult, ragResult] = await Promise.allSettled([
        chatService.sendMessage({ mensaje, conversacionId: state.id }),
        chatService.sendRagMessage(mensaje)
      ])
      if (chatState.value !== state) return

      const catalog = catalogResult.status === 'fulfilled' ? catalogResult.value : null
      const rag = ragResult.status === 'fulfilled' ? ragResult.value : null
      if (!catalog && !rag) {
        throw new Error(
          [failureMessage(catalogResult), failureMessage(ragResult)]
            .filter(Boolean)
            .join(' ') || 'No se pudieron consultar el catálogo ni la base RAG.'
        )
      }

      if (catalog) state.id = catalog.conversacionId
      state.turns.push({
        role: 'assistant',
        text: rag?.reply || catalog?.respuesta || 'No se recibió una respuesta.',
        catalogReply: rag?.reply && catalog?.eventos?.length ? catalog.respuesta : '',
        events: catalog?.eventos || [],
        sources: Array.isArray(rag?.sources) ? rag.sources : []
      })
      if (!catalog || !rag) {
        const failedRequest = catalog ? ragResult : catalogResult
        state.error =
          failureMessage(failedRequest) || 'No se pudo completar una de las consultas.'
      }
    }
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
        <p v-if="!agentMode">Eventos, cupos y presupuestos en una conversación.</p>
        <p v-else class="assistant-agent-status">
          Modo Agente activo: puede aplicar parches permitidos del backend, sujetos a pruebas y
          verificación local.
        </p>
      </div>
      <q-btn
        outline
        color="primary"
        no-caps
        icon="add"
        label="Nueva conversación"
        :disable="chatState.pending || (!chatState.turns.length && !chatState.draft)"
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
          <span class="assistant-speaker">
            {{
              turn.role === 'user'
                ? 'Tú'
                : turn.mode === 'agent'
                  ? 'Agente IA · Administrador'
                  : 'Asistente IA'
            }}
          </span>
          <div class="assistant-bubble">{{ turn.text }}</div>
          <div v-if="turn.catalogReply" class="assistant-catalog-reply">
            <strong>Detalle del catálogo</strong>
            <p>{{ turn.catalogReply }}</p>
          </div>
          <details
            v-if="turn.role === 'assistant' && turn.sources?.length"
            class="assistant-sources"
          >
            <summary>Fuentes consultadas ({{ turn.sources.length }})</summary>
            <ul>
              <li v-for="(source, sourceIndex) in turn.sources" :key="sourceIndex">
                {{ sourceLabel(source, sourceIndex) }}
                <small v-if="Number.isFinite(Number(source?.similarity))">
                  · {{ Math.round(Number(source.similarity) * 100) }}% de relevancia
                </small>
              </li>
            </ul>
          </details>
          <section v-if="turn.mode === 'agent'" class="assistant-agent-audit">
            <h2>Bitácora de ejecución</h2>
            <ol v-if="turn.actions.length">
              <li v-for="(action, actionIndex) in turn.actions" :key="actionIndex">
                Herramienta ejecutada: <code>{{ actionLabel(action) }}</code>
              </li>
            </ol>
            <p v-else>No se registraron herramientas ejecutadas.</p>
            <article v-if="turn.patch" class="assistant-patch-card">
              <h3>Actualización aplicada</h3>
              <dl>
                <dt>Repositorio</dt>
                <dd>{{ turn.patch.target_repo || turn.patch.targetRepo }}</dd>
                <dt>Archivo</dt>
                <dd><code>{{ turn.patch.file_path || turn.patch.filePath }}</code></dd>
                <dt>Estado</dt>
                <dd>{{ patchStatusLabel(turn.patch.status) }}</dd>
              </dl>
              <details>
                <summary>Ver diff de auditoría</summary>
                <pre>{{ turn.patch.diff_content || turn.patch.diffContent }}</pre>
              </details>
            </article>
          </section>
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
          <q-spinner color="primary" />
          {{
            agentMode
              ? 'Ejecutando herramientas administrativas…'
              : 'Consultando el catálogo y RAG…'
          }}
        </div>
        <div ref="latest" />
      </div>
      <div class="assistant-compose">
        <div v-if="isAdmin" class="assistant-controls">
          <q-toggle
            v-model="agentMode"
            color="primary"
            label="Modo Agente"
            :disable="chatState.pending"
          />
          <span v-if="agentMode" class="assistant-admin-only">Solo administrador</span>
        </div>
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
            :label="agentMode ? 'Describe la tarea administrativa' : 'Pregunta sobre un evento'"
            :maxlength="agentMode ? 8000 : 2000"
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