<script setup>
// Bloque de error de carga con acciones siempre visibles, para que la web no parezca congelada.
defineProps({
  message: { type: String, required: true },
  busy: { type: Boolean, default: false }
})
const emit = defineEmits(['retry'])

function reloadPage() {
  window.location.reload()
}
</script>

<template>
  <div class="load-error" role="alert">
    <q-icon name="wifi_off" size="40px" class="load-error__icon" aria-hidden="true" />
    <p class="load-error__text">{{ message }}</p>
    <div class="load-error__actions">
      <q-btn
        unelevated
        rounded
        no-caps
        color="primary"
        icon="refresh"
        label="Reintentar"
        :loading="busy"
        @click="emit('retry')"
      />
      <q-btn outline rounded no-caps color="primary" label="Actualizar página" @click="reloadPage" />
    </div>
  </div>
</template>

<style scoped>
.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 36px 20px;
  margin: 8px 0 24px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--border-color));
  background: color-mix(in srgb, var(--danger) 7%, var(--bg-secondary));
}

.load-error__icon {
  color: color-mix(in srgb, var(--danger) 70%, var(--text-primary));
}

.load-error__text {
  margin: 0;
  max-width: 460px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--text-primary);
}

.load-error__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 4px;
}
</style>
