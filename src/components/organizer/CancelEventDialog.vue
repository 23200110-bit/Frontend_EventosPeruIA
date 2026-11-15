<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { eventService } from '@/services/eventService'
import { required } from '@/utils/validators'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  event: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'canceled'])

// Motivos exactos precargados en la tabla motivos_cancelacion de PostgreSQL
const CANCEL_REASONS = [
  { label: 'Fuerza mayor', value: 1 },
  { label: 'Orden o restricción de una autoridad', value: 2 },
  { label: 'Problemas en el recinto o local del evento', value: 3 },
  { label: 'Imposibilidad del artista o expositor principal', value: 4 },
  { label: 'Clima adverso', value: 5 },
  { label: 'Razones de seguridad', value: 6 },
  { label: 'Otro motivo justificado', value: 7 }
]

const form = reactive({
  motivoCancelacionId: null,
  descripcionAdicional: '',
  confirmed: false
})

const submitting = ref(false)
const errorMsg = ref('')

const soldCount = computed(() => Number(props.event?.ticketsVendidos ?? 0))

const canSubmit = computed(() => {
  return (
    Boolean(form.motivoCancelacionId) &&
    form.descripcionAdicional.trim().length > 0 &&
    form.confirmed === true &&
    !submitting.value
  )
})

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      form.motivoCancelacionId = null
      form.descripcionAdicional = ''
      form.confirmed = false
      errorMsg.value = ''
    }
  }
)

function closeDialog() {
  if (!submitting.value) {
    emit('update:modelValue', false)
  }
}

async function confirmCancel() {
  errorMsg.value = ''
  if (!form.motivoCancelacionId) {
    errorMsg.value = 'Selecciona un motivo de cancelación.'
    return
  }
  if (!form.descripcionAdicional.trim()) {
    errorMsg.value = 'Ingresa una descripción detallada del motivo de cancelación.'
    return
  }
  if (!form.confirmed) {
    errorMsg.value = 'Debes confirmar que entiendes que esta acción es irreversible.'
    return
  }

  submitting.value = true
  try {
    await eventService.cancelEvent(props.event.eventoId, {
      motivoCancelacionId: Number(form.motivoCancelacionId),
      descripcionAdicional: form.descripcionAdicional.trim()
    })
    emit('canceled', props.event.eventoId)
    emit('update:modelValue', false)
  } catch (e) {
    errorMsg.value = e.message || 'No se pudo cancelar el evento.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <q-dialog :model-value="modelValue" persistent @update:model-value="closeDialog">
    <q-card style="width: 100%; max-width: 520px; border-radius: 20px; padding: 8px;">
      <q-card-section style="display: flex; align-items: center; gap: 12px;">
        <q-avatar color="red-1" text-color="negative" icon="warning" />
        <div>
          <div class="eyebrow" style="color: #dc2626;">ACCIÓN IRREVERSIBLE</div>
          <h3 style="margin: 0; font-size: 1.2rem;">Cancelar evento</h3>
        </div>
      </q-card-section>

      <q-card-section style="padding-top: 0;">
        <p style="margin: 0 0 12px;">
          Estás a punto de cancelar el evento <strong>"{{ event?.nombre }}"</strong>.
        </p>

        <!-- Advertencia de impacto de cancelación -->
        <q-banner rounded class="bg-red-1 text-red-10" style="margin-bottom: 16px;">
          <template #avatar>
            <q-icon name="info" color="negative" />
          </template>
          <div v-if="soldCount > 0">
            <strong>Atención:</strong> Este evento tiene <strong>{{ soldCount }} entrada(s) vendida(s)</strong>.
            Al cancelar, sus códigos QR quedarán anulados, se marcarán como <em>Pendiente de reembolso</em> y se notificará a todos los compradores afectados.
          </div>
          <div v-else>
            Este evento aún no tiene entradas vendidas, pero una vez cancelado <strong>no podrá volver a publicarse ni editarse</strong>.
          </div>
        </q-banner>

        <q-banner v-if="errorMsg" class="error" role="alert" style="margin-bottom: 14px;">
          {{ errorMsg }}
        </q-banner>

        <div style="display: grid; gap: 14px;">
          <q-select
            v-model="form.motivoCancelacionId"
            outlined
            emit-value
            map-options
            :options="CANCEL_REASONS"
            label="Motivo de cancelación *"
            :rules="[(v) => !!v || 'Selecciona un motivo.']"
          />

          <q-input
            v-model="form.descripcionAdicional"
            outlined
            type="textarea"
            rows="3"
            maxlength="500"
            counter
            label="Descripción justificada (visible en el registro) *"
            placeholder="Explica brevemente la causa de la cancelación para los asistentes..."
            :rules="[required]"
          />

          <q-checkbox
            v-model="form.confirmed"
            color="negative"
            label="Confirmo que deseo cancelar este evento de forma permanente e irreversible."
          />
        </div>
      </q-card-section>

      <q-card-actions align="right" style="padding: 12px 16px;">
        <q-btn
          flat
          no-caps
          color="grey-8"
          label="Volver"
          :disable="submitting"
          @click="closeDialog"
        />
        <q-btn
          unelevated
          rounded
          no-caps
          color="negative"
          icon="cancel"
          label="Confirmar cancelación"
          :loading="submitting"
          :disable="!canSubmit"
          @click="confirmCancel"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>