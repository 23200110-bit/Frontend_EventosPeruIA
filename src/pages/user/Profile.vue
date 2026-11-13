<script setup>
import { onMounted, reactive, ref } from 'vue'
import { eventService } from '@/services/eventService'
import { userService } from '@/services/userService'
import { required } from '@/utils/validators'

const categories = ref([])
const busy = ref(true)
const error = ref('')
const success = ref('')

const form = reactive({
  firstName: '',
  lastName: '',
  phone: '',
  city: '',
  photoUrl: '',
  latitude: null,
  longitude: null,
  interestCategoryIds: []
})

async function save() {
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    await userService.updateProfile(form)
    success.value = 'Tus preferencias se guardaron correctamente.'
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  try {
    const [profile, cats] = await Promise.all([
      userService.getProfile(),
      eventService.getCategories()
    ])
    categories.value = cats
    Object.assign(form, profile, {
      interestCategoryIds: profile.interests.map((x) => x.categoryId)
    })
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
})
</script>

<template>
  <q-page class="container narrow">
    <div class="eyebrow">TU CUENTA</div>
    <h1 class="page-heading">Tu perfil, tus planes</h1>
    <p>Cuéntanos qué te interesa. La ubicación es opcional.</p>

    <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>
    <q-banner v-if="success" class="success" role="status">{{ success }}</q-banner>

    <q-form class="surface form-stack" @submit="save">
      <q-input
        v-model="form.firstName"
        outlined
        label="Nombres"
        maxlength="100"
        :rules="[required]"
      />
      <q-input
        v-model="form.lastName"
        outlined
        label="Apellidos"
        maxlength="100"
        :rules="[required]"
      />
      <q-input v-model="form.phone" outlined label="Teléfono" maxlength="20" />
      <q-input v-model="form.city" outlined label="Ciudad (opcional)" maxlength="100" />
      <q-select
        v-model="form.interestCategoryIds"
        outlined
        multiple
        use-chips
        label="Categorías de interés"
        :options="categories"
        option-value="id"
        option-label="name"
        emit-value
        map-options
      />
      <q-btn
        type="submit"
        no-caps
        unelevated
        color="primary"
        label="Guardar preferencias"
        :loading="busy"
      />
    </q-form>
  </q-page>
</template>