<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { eventService } from '@/services/eventService'
import FlyerImport from '@/components/FlyerImport.vue'
import {
  maxLengthRule,
  nonNegativeNumberRule,
  positiveIntRule,
  required
} from '@/utils/validators'

const route = useRoute()
const router = useRouter()

const isEditMode = computed(() => Boolean(route.params.id))
const eventForm = ref(null)
const originalEvent = ref(null)
const isDraft = computed(() => !isEditMode.value || originalEvent.value?.estado === 'Borrador')
const categories = ref([])
const loadingData = ref(false)
const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const soldTickets = ref(0)

// Estado para subida de imagen a Supabase Storage
const imageFile = ref(null)
const uploadingImage = ref(false)
const saveBlocked = computed(
  () => saving.value || uploadingImage.value || Boolean(successMsg.value) ||
    (isEditMode.value && !originalEvent.value)
)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const form = reactive({
  nombre: '',
  descripcion: '',
  categoriaId: null,
  fechaInicio: '',
  horaInicio: '19:00',
  fechaFin: '',
  horaFin: '',
  ciudad: 'Lima',
  nombreLugar: '',
  direccion: '',
  aforo: 100,
  precio: 0,
  imagenUrl: ''
})

async function onImageSelected(file) {
  if (!file) return
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    errorMsg.value = 'Faltan configurar VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el .env.'
    return
  }

  uploadingImage.value = true
  errorMsg.value = ''
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `portada_${Date.now()}.${ext}`
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/eventos-portadas/${fileName}`

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': file.type || 'image/jpeg'
      },
      body: file
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.message || 'No se pudo subir la imagen a Supabase Storage.')
    }

    form.imagenUrl = `${SUPABASE_URL}/storage/v1/object/public/eventos-portadas/${fileName}`
  } catch (e) {
    errorMsg.value = e.message || 'Error al subir la imagen.'
  } finally {
    uploadingImage.value = false
  }
}

// Borrador sugerido desde un flyer: solo rellena lo detectado; nada se guarda hasta que la persona lo decida.
const draftNotice = ref('')
const normalize = (text) =>
  String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

function applyDraft({ draft, file }) {
  errorMsg.value = ''
  const filled = []
  const missing = []
  const has = (value) => value !== null && value !== undefined && value !== ''
  // Un dato que no está en el flyer se deja en blanco (no se conservan valores por defecto).
  const set = (label, value, apply, blank) => {
    if (has(value)) {
      apply(value)
      filled.push(label)
    } else {
      blank()
      missing.push(label)
    }
  }
  set('nombre', draft.nombre, (v) => (form.nombre = v), () => (form.nombre = ''))
  set('descripción', draft.descripcion, (v) => (form.descripcion = v), () => (form.descripcion = ''))
  set(
    'categoría',
    draft.categoria,
    (v) => {
      const match = categories.value.find((c) => normalize(c.label) === normalize(v))
      form.categoriaId = match ? match.value : null
    },
    () => (form.categoriaId = null)
  )
  set('fecha de inicio', draft.fechaInicio, (v) => (form.fechaInicio = v), () => (form.fechaInicio = ''))
  set('hora de inicio', draft.horaInicio, (v) => (form.horaInicio = v), () => (form.horaInicio = ''))
  form.fechaFin = draft.fechaFin || ''
  form.horaFin = draft.horaFin || ''
  set('ciudad', draft.ciudad, (v) => (form.ciudad = v), () => (form.ciudad = ''))
  set('recinto', draft.nombreLugar, (v) => (form.nombreLugar = v), () => (form.nombreLugar = ''))
  set('dirección', draft.direccion, (v) => (form.direccion = v), () => (form.direccion = ''))
  set('precio', draft.precio, (v) => (form.precio = Number(v)), () => (form.precio = ''))
  set('aforo', draft.aforo, (v) => (form.aforo = Number(v)), () => (form.aforo = ''))

  let notice = filled.length
    ? 'Borrador generado desde el flyer. Revisa todos los datos antes de guardar.'
    : 'No se pudo detectar información del evento en la imagen. Prueba con otra más nítida o llena el formulario a mano.'
  if (filled.length && missing.length) {
    notice += ` No aparece en el flyer y quedó en blanco: ${missing.join(', ')}.`
  }
  if (draft.fechaInicio && draft.anioIndicado === false) {
    notice += ` El flyer no indica el año: se asumió ${draft.fechaInicio.slice(0, 4)}, verifícalo.`
  }
  draftNotice.value = notice
  lastFlyerFile.value = file || null
  if (useAsCover.value && file) void uploadFlyerAsCover(file)
}
const useAsCover = ref(false)
const lastFlyerFile = ref(null)
const COVER_OK = ' Portada: el flyer se cargó como imagen del evento.'
const COVER_FAIL = ' No se pudo cargar el flyer como portada: '

// Sube el flyer como portada y lo informa en el aviso (si falla, se ve junto al flyer).
async function uploadFlyerAsCover(file) {
  draftNotice.value = draftNotice.value.split(COVER_OK)[0].split(COVER_FAIL)[0]
  await onImageSelected(file)
  if (form.imagenUrl) draftNotice.value += COVER_OK
  else draftNotice.value += COVER_FAIL + (errorMsg.value || 'error desconocido.')
}

// Si se marca la casilla después de analizar el flyer, también se aplica.
watch(useAsCover, (on) => {
  if (on && lastFlyerFile.value && !uploadingImage.value) void uploadFlyerAsCover(lastFlyerFile.value)
})

const capacityRule = (val) => {
  const base = positiveIntRule(val)
  if (base !== true) return base
  if (isEditMode.value && Number(val) < soldTickets.value) {
    return `El aforo no puede ser menor a las entradas ya vendidas (${soldTickets.value}).`
  }
  return true
}

const limaDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

function splitIsoDateTime(isoStr) {
  if (!isoStr) return { date: '', time: '' }

  const instant = new Date(isoStr)
  if (Number.isNaN(instant.getTime())) return { date: '', time: '' }

  const parts = Object.fromEntries(
    limaDateTime.formatToParts(instant).map(({ type, value }) => [type, value])
  )

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  }
}

function toIsoPeru(dateStr, timeStr, originalIso) {
  if (!dateStr) return null

  const cleanTime = timeStr && timeStr.length >= 5 ? timeStr.slice(0, 5) : '00:00'
  const original = splitIsoDateTime(originalIso)
  if (original.date === dateStr && original.time === cleanTime) return originalIso

  return `${dateStr}T${cleanTime}:00-05:00`
}

async function init() {
  loadingData.value = true
  errorMsg.value = ''
  try {
    const cats = await eventService.getCategories()
    const rawList = Array.isArray(cats) ? cats : cats?.items || []
    categories.value = rawList.map((c) => ({
      label: c.nombre || c.name,
      value: c.categoriaId ?? c.id
    }))

    if (isEditMode.value) {
      const detail = await eventService.getMyEventDetail(route.params.id)
      originalEvent.value = detail
      form.nombre = detail.nombre || ''
      form.descripcion = detail.descripcion || ''
      form.categoriaId = detail.categoria?.categoriaId ?? null
      form.ciudad = detail.ciudad || 'Lima'
      form.nombreLugar = detail.nombreLugar || ''
      form.direccion = detail.direccion || ''
      form.aforo = detail.aforo ?? 100
      form.precio = detail.precio ?? 0
      form.imagenUrl = detail.imagenUrl || ''
      soldTickets.value = Number(detail.ticketsVendidos ?? 0)

      const start = splitIsoDateTime(detail.fechaInicio)
      form.fechaInicio = start.date
      form.horaInicio = start.time || '19:00'

      if (detail.fechaFin) {
        const end = splitIsoDateTime(detail.fechaFin)
        form.fechaFin = end.date
        form.horaFin = end.time
      }
    }
  } catch (e) {
    errorMsg.value = e.message || 'Error al cargar los datos del formulario.'
  } finally {
    loadingData.value = false
  }
}

async function publishEvent() {
  if (!isDraft.value || saveBlocked.value) return

  if (await eventForm.value?.validate()) {
    await submitEvent(true)
  }
}

async function submitEvent(shouldPublish) {
  if (saveBlocked.value) return

  errorMsg.value = ''
  successMsg.value = ''

  if (!form.categoriaId) {
    errorMsg.value = 'Selecciona una categoría para el evento.'
    return
  }
  if (!form.fechaInicio || !form.horaInicio) {
    errorMsg.value = 'Indica la fecha y hora de inicio del evento.'
    return
  }
  if (form.aforo === '' || form.aforo === null || form.precio === '' || form.precio === null) {
    errorMsg.value = 'Indica el aforo y el precio de entrada (0 si es gratis).'
    return
  }
  if (isEditMode.value && Number(form.aforo) < soldTickets.value) {
    errorMsg.value = `No puedes reducir el aforo por debajo de ${soldTickets.value} entradas vendidas.`
    return
  }

  const payload = {
    categoriaId: Number(form.categoriaId),
    nombre: form.nombre.trim(),
    descripcion: form.descripcion.trim(),
    fechaInicio: toIsoPeru(form.fechaInicio, form.horaInicio, originalEvent.value?.fechaInicio),
    fechaFin: toIsoPeru(form.fechaFin, form.horaFin || '23:59', originalEvent.value?.fechaFin),
    direccion: form.direccion.trim(),
    ciudad: form.ciudad.trim(),
    latitud: originalEvent.value?.latitud ?? null,
    longitud: originalEvent.value?.longitud ?? null,
    aforo: Number(form.aforo),
    precio: Number(form.precio),
    publicar: shouldPublish,
    imagenUrl: form.imagenUrl?.trim() || null,
    nombreLugar: form.nombreLugar?.trim() || null
  }

  saving.value = true
  try {
    if (isEditMode.value) {
      await eventService.updateEvent(route.params.id, {
        ...payload,
        versionFila: originalEvent.value?.versionFila ?? null
      })
      successMsg.value = shouldPublish
        ? '¡Evento publicado con éxito!'
        : 'Evento actualizado correctamente.'
    } else {
      await eventService.createEvent(payload)
      successMsg.value = shouldPublish
        ? '¡Evento publicado con éxito!'
        : 'Evento guardado como borrador.'
    }

    setTimeout(() => {
      router.push('/organizador/mis-eventos')
    }, 800)
  } catch (e) {
    errorMsg.value = e.message || 'No se pudo guardar el evento.'
  } finally {
    saving.value = false
  }
}

onMounted(init)
</script>

<template>
  <q-page class="container" style="max-width: 860px;">
    <div style="margin-bottom: 20px;">
      <q-btn
        flat
        no-caps
        color="white"
        icon="arrow_back"
        label="Volver a Mis eventos"
        @click="router.push('/organizador/mis-eventos')"
      />
      <div class="eyebrow" style="margin-top: 8px;">PANEL DE ORGANIZADOR</div>
      <h1 class="page-heading" style="margin-bottom: 4px;">
        {{ isEditMode ? 'Editar evento' : 'Crear nuevo evento' }}
      </h1>
      <p class="muted" style="margin: 0;">
        Completa los datos principales. Puedes guardarlo como borrador o publicarlo al instante.
      </p>
    </div>

    <q-banner v-if="errorMsg" class="error" role="alert" style="margin-bottom: 16px;">
      {{ errorMsg }}
    </q-banner>
    <q-banner
      v-if="successMsg"
      rounded
      class="bg-positive text-white"
      style="margin-bottom: 16px;"
    >
      {{ successMsg }}
    </q-banner>

    <div v-if="loadingData" class="empty">
      <q-spinner color="primary" size="28px" /> Cargando información...
    </div>

    <FlyerImport
      v-if="!loadingData && !isEditMode"
      :categories="categories"
      :disabled="saving || uploadingImage"
      @draft="applyDraft"
    />
    <q-checkbox
      v-if="!loadingData && !isEditMode"
      v-model="useAsCover"
      dense
      label="Usar también el flyer como imagen de portada del evento"
      style="margin: -6px 0 14px;"
    />
    <q-banner
      v-if="draftNotice"
      rounded
      class="bg-blue-1 text-primary"
      style="margin-bottom: 16px;"
    >
      {{ draftNotice }}
    </q-banner>

    <q-form
      v-if="!loadingData"
      ref="eventForm"
      class="surface"
      style="border-radius: 20px; padding: 28px;"
      @submit.prevent="submitEvent(false)"
    >
      <div style="display: grid; gap: 18px;">
        <!-- Nombre y Categoría -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
          <q-input
            v-model="form.nombre"
            outlined
            label="Nombre del evento *"
            placeholder="Ej. Festival Lima Sound 2026"
            :rules="[required, maxLengthRule(150)]"
          />

          <q-select
            v-model="form.categoriaId"
            outlined
            emit-value
            map-options
            :options="categories"
            label="Categoría *"
            :rules="[(v) => !!v || 'Selecciona una categoría.']"
          />
        </div>

        <!-- Descripción -->
        <q-input
          v-model="form.descripcion"
          outlined
          type="textarea"
          rows="4"
          label="Descripción del evento *"
          placeholder="Describe la experiencia, artistas invitados, cronograma o recomendaciones..."
          :rules="[required]"
        />

        <!-- Fecha y Hora Inicio / Fin -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
          <q-input
            v-model="form.fechaInicio"
            outlined
            type="date"
            label="Fecha de inicio *"
            stack-label
            :rules="[required]"
          />
          <q-input
            v-model="form.horaInicio"
            outlined
            type="time"
            label="Hora de inicio *"
            stack-label
            :rules="[required]"
          />
          <q-input
            v-model="form.fechaFin"
            outlined
            type="date"
            label="Fecha de fin (opcional)"
            stack-label
          />
          <q-input
            v-model="form.horaFin"
            outlined
            type="time"
            label="Hora de fin (opcional)"
            stack-label
          />
        </div>

        <!-- Ubicación -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          <q-input
            v-model="form.ciudad"
            outlined
            label="Ciudad *"
            placeholder="Ej. Lima"
            :rules="[required, maxLengthRule(100)]"
          />
          <q-input
            v-model="form.nombreLugar"
            outlined
            label="Nombre del recinto / local"
            placeholder="Ej. Arena 1 - Costa Verde"
          />
          <q-input
            v-model="form.direccion"
            outlined
            label="Dirección exacta *"
            placeholder="Ej. Circuito de Playas s/n, San Miguel"
            :rules="[required, maxLengthRule(250)]"
          />
        </div>

        <!-- Aforo y Precio -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          <q-input
            v-model.number="form.aforo"
            outlined
            type="number"
            min="1"
            step="1"
            label="Aforo total (cupos) *"
            :hint="isEditMode && soldTickets > 0 ? `Mínimo permitido: ${soldTickets} (ya vendidas)` : ''"
            :rules="[capacityRule]"
          />

          <q-input
            v-model.number="form.precio"
            outlined
            type="number"
            min="0"
            step="0.5"
            prefix="S/"
            label="Precio de entrada (0 = Gratis) *"
            :rules="[nonNegativeNumberRule]"
          />
        </div>

        <!-- Imagen de portada (Subir archivo a Supabase Storage o pegar URL) -->
        <div style="display: grid; gap: 12px; padding: 16px; border: 1px dashed #cbd5e1; border-radius: 14px; background: #f8fafc;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
            <q-file
              v-model="imageFile"
              outlined
              bg-color="white"
              accept="image/*"
              max-file-size="5242880"
              label="Subir imagen desde tu dispositivo (máx. 5 MB)"
              :loading="uploadingImage"
              :disable="uploadingImage || saving"
              @update:model-value="onImageSelected"
            >
              <template #prepend>
                <q-icon name="cloud_upload" color="primary" />
              </template>
            </q-file>

            <q-input
              v-model="form.imagenUrl"
              outlined
              clearable
              bg-color="white"
              label="O pega una URL de imagen de portada"
              placeholder="https://..."
              :disable="uploadingImage || saving"
            />
          </div>

          <div v-if="form.imagenUrl" style="display: flex; align-items: center; gap: 14px; min-width: 0;">
            <img
              :src="form.imagenUrl"
              alt="Vista previa de portada"
              style="width: 140px; height: 84px; flex-shrink: 0; border-radius: 10px; object-fit: cover; border: 1px solid #e2e8f0;"
            />
            <div style="font-size: 0.85rem; color: #475569; min-width: 0; overflow-wrap: anywhere;">
              <strong>Portada lista</strong>
              <div>{{ form.imagenUrl }}</div>
            </div>
          </div>
        </div>

        <!-- Botones de acción -->
        <div style="display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap; margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <q-btn
            flat
            no-caps
            color="grey-8"
            label="Cancelar"
            :disable="saving || uploadingImage"
            @click="router.push('/organizador/mis-eventos')"
          />

          <q-btn
            :outline="isDraft"
            :unelevated="!isDraft"
            rounded
            no-caps
            color="primary"
            :icon="isDraft ? 'save' : 'check'"
            :label="isDraft ? 'Guardar como borrador' : 'Actualizar evento'"
            type="submit"
            :loading="saving"
            :disable="saveBlocked"
          />

          <q-btn
            v-if="isDraft"
            unelevated
            rounded
            no-caps
            color="primary"
            icon="publish"
            label="Publicar evento"
            type="button"
            :loading="saving"
            :disable="saveBlocked"
            @click="publishEvent"
          />
        </div>
      </div>
    </q-form>
  </q-page>
</template>