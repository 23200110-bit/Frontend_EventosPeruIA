<script setup>
import { ref } from 'vue'
import { eventService } from '@/services/eventService'

const props = defineProps({
  categories: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['draft'])

const file = ref(null)
const busy = ref(false)
const error = ref('')
const preview = ref('')
const MAX_SIDE = 1600

// Reduce la imagen en el navegador (lado máximo 1600 px, JPEG) para enviar menos datos a la API.
function toJpegBase64(source) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85) })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    img.src = url
  })
}

async function analyze(selected) {
  error.value = ''
  preview.value = ''
  if (!selected) return
  busy.value = true
  try {
    const { dataUrl } = await toJpegBase64(selected)
    preview.value = dataUrl
    const draft = await eventService.draftFromFlyer({
      mimeType: 'image/jpeg',
      dataBase64: dataUrl.split(',')[1],
      categorias: props.categories.map((c) => c.label).filter(Boolean)
    })
    emit('draft', { draft, file: selected })
  } catch (e) {
    error.value = e.message || 'No se pudo analizar el flyer.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flyer-import">
    <div class="flyer-import__head">
      <q-icon name="auto_awesome" color="primary" size="22px" />
      <div>
        <strong>Autocompletar desde un flyer</strong>
        <p>
          Sube la imagen de un flyer o volante y la IA llenará el formulario como borrador. Tú lo
          revisas, lo corriges y decides si lo guardas o lo publicas.
        </p>
      </div>
    </div>
    <q-file
      v-model="file"
      outlined
      bg-color="white"
      accept="image/jpeg,image/png,image/webp"
      max-file-size="10485760"
      label="Elegir imagen del flyer (JPG, PNG o WEBP)"
      :loading="busy"
      :disable="busy || disabled"
      @update:model-value="analyze"
      @rejected="error = 'Elige una imagen JPG, PNG o WEBP de hasta 10 MB.'"
    >
      <template #prepend><q-icon name="image_search" color="primary" /></template>
    </q-file>
    <p v-if="busy" class="flyer-import__status">
      <q-spinner color="primary" size="16px" /> Leyendo el flyer… puede tardar unos segundos.
    </p>
    <p v-if="error" class="flyer-import__error" role="alert">{{ error }}</p>
    <img v-if="preview && !busy" :src="preview" alt="Flyer cargado" class="flyer-import__preview" />
  </div>
</template>

<style scoped>
.flyer-import {
  display: grid;
  gap: 12px;
  padding: 16px;
  margin-bottom: 18px;
  border: 1px dashed #b9a8ff;
  border-radius: 14px;
  background: #f6f3ff;
}
.flyer-import__head { display: flex; gap: 12px; align-items: flex-start; }
.flyer-import__head p { margin: 4px 0 0; color: #6b6585; font-size: 14px; }
.flyer-import__status { margin: 0; color: #4b3fb0; font-size: 14px; }
.flyer-import__error { margin: 0; color: #b3261e; font-size: 14px; font-weight: 600; }
.flyer-import__preview { max-height: 160px; max-width: 100%; border-radius: 10px; justify-self: start; }
</style>
