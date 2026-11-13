<script setup>
defineProps({
  qr: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close'])
</script>

<template>
  <q-dialog :model-value="!!qr" @update:model-value="emit('close')">
    <q-card class="q-pa-lg text-center">
      <h3>Tu entrada digital</h3>
      <img :src="qr" alt="Código QR de la entrada" width="260" height="260" />
      <p>Presenta este QR al ingresar.</p>
      <q-btn flat label="Cerrar" @click="emit('close')" />
    </q-card>
  </q-dialog>
</template>