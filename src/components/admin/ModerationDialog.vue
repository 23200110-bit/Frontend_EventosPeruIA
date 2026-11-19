<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirmar' },
  color: { type: String, default: 'negative' },
  busy: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const motivo = ref('')
const confirmed = ref(false)

const valid = computed(() => motivo.value.trim().length >= 3 && confirmed.value)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      motivo.value = ''
      confirmed.value = false
    }
  }
)

function close() {
  if (!props.busy) emit('update:modelValue', false)
}

function submit() {
  if (valid.value && !props.busy) emit('confirm', motivo.value.trim())
}
</script>

<template>
  <q-dialog :model-value="modelValue" persistent @update:model-value="close">
    <q-card style="min-width: 360px; max-width: 520px; width: 100%">
      <q-card-section>
        <div class="text-h6">{{ title }}</div>
        <p v-if="message" class="muted" style="margin: 8px 0 0">{{ message }}</p>
      </q-card-section>

      <q-card-section class="form-stack">
        <q-input
          v-model="motivo"
          type="textarea"
          outlined
          autogrow
          maxlength="300"
          counter
          label="Motivo de la acción *"
          hint="Mínimo 3 caracteres. Queda registrado para auditoría."
          :disable="busy"
        />
        <q-checkbox
          v-model="confirmed"
          label="Confirmo que deseo ejecutar esta acción"
          :disable="busy"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat no-caps label="Cancelar" :disable="busy" @click="close" />
        <q-btn
          unelevated
          no-caps
          :color="color"
          :label="confirmLabel"
          :loading="busy"
          :disable="!valid"
          @click="submit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
