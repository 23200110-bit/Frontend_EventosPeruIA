<script setup>
import { computed, ref } from 'vue'
import '@/assets/styles/panel-theme.css'
import { eventService } from '@/services/eventService'
import { session } from '@/stores/authStore'
import AdminUsersTable from '@/components/admin/AdminUsersTable.vue'
import AdminEventsTable from '@/components/admin/AdminEventsTable.vue'
import ModerationDialog from '@/components/admin/ModerationDialog.vue'

const isAdmin = computed(() => session.user?.isAdministrator === true)

const tab = ref('usuarios')
const usersTable = ref(null)
const eventsTable = ref(null)

const dialogOpen = ref(false)
const pending = ref(null)
const busy = ref(false)
const error = ref('')
const success = ref('')

const dialog = computed(() => {
  const p = pending.value
  if (!p) return { title: '', message: '', label: '', color: 'negative' }
  if (p.type === 'user') {
    const name = `${p.user.nombres} ${p.user.apellidos}`.trim()
    return p.estado === 'Bloqueado'
      ? {
          title: `Bloquear a ${name}`,
          message:
            'La cuenta no podrá iniciar una nueva sesión mientras esté bloqueada. Podrás reactivarla después.',
          label: 'Bloquear cuenta',
          color: 'negative'
        }
      : {
          title: `Reactivar a ${name}`,
          message: 'La cuenta volverá a poder iniciar sesión.',
          label: 'Reactivar cuenta',
          color: 'positive'
        }
  }
  return p.accion === 'Retirar'
    ? {
        title: `Retirar «${p.event.nombre}»`,
        message:
          'El evento dejará de aparecer en búsquedas y recomendaciones públicas. Esta acción no se puede deshacer desde este panel.',
        label: 'Retirar evento',
        color: 'negative'
      }
    : {
        title: `Suspender «${p.event.nombre}»`,
        message: 'El evento dejará de mostrarse públicamente hasta nueva revisión.',
        label: 'Suspender evento',
        color: 'orange'
      }
})

function askUser({ user, estado }) {
  pending.value = { type: 'user', user, estado }
  dialogOpen.value = true
}

function askEvent({ event, accion }) {
  pending.value = { type: 'event', event, accion }
  dialogOpen.value = true
}

async function confirm(motivo) {
  const p = pending.value
  if (!p) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    if (p.type === 'user') {
      await eventService.adminToggleUser(p.user.usuarioId, { estado: p.estado, motivo })
      success.value =
        p.estado === 'Bloqueado' ? 'La cuenta fue bloqueada.' : 'La cuenta fue reactivada.'
      await usersTable.value?.refresh()
    } else {
      await eventService.adminModerateEvent(p.event.eventoId, { accion: p.accion, motivo })
      success.value =
        p.accion === 'Retirar' ? 'El evento fue retirado.' : 'El evento fue suspendido.'
      await eventsTable.value?.refresh()
    }
    dialogOpen.value = false
    pending.value = null
  } catch (e) {
    dialogOpen.value = false
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <q-page class="container panel-page">
    <header class="panel-hero">
      <div class="eyebrow">PANEL ADMINISTRATIVO · US-016</div>
      <h1 class="panel-title">Moderación de la plataforma</h1>
      <p v-if="isAdmin">
        Busca usuarios y eventos, bloquea o reactiva cuentas y retira o suspende eventos que
        incumplan las reglas. Cada acción pide confirmación y queda registrada para auditoría.
      </p>
    </header>

    <q-banner v-if="!isAdmin" class="error" role="alert">
      Solo los administradores pueden acceder a este panel.
    </q-banner>

    <template v-else>
      <q-banner v-if="success" class="success" role="status">{{ success }}</q-banner>
      <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>

      <q-tabs v-model="tab" align="left" no-caps active-color="primary" indicator-color="primary">
        <q-tab name="usuarios" icon="group" label="Usuarios" />
        <q-tab name="eventos" icon="event" label="Eventos publicados" />
      </q-tabs>
      <q-separator />

      <q-tab-panels v-model="tab" animated keep-alive class="surface" style="padding: 16px">
        <q-tab-panel name="usuarios" style="padding: 0">
          <AdminUsersTable ref="usersTable" @toggle="askUser" />
        </q-tab-panel>
        <q-tab-panel name="eventos" style="padding: 0">
          <AdminEventsTable ref="eventsTable" @moderate="askEvent" />
        </q-tab-panel>
      </q-tab-panels>

      <ModerationDialog
        v-model="dialogOpen"
        :title="dialog.title"
        :message="dialog.message"
        :confirm-label="dialog.label"
        :color="dialog.color"
        :busy="busy"
        @confirm="confirm"
      />
    </template>
  </q-page>
</template>
