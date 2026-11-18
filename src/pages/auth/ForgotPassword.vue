<script setup>
// US-018: recuperación de contraseña
import { computed, onMounted, ref } from 'vue'
import { authService } from '@/services/authService'
import { required, emailRule } from '@/utils/validators'

const GENERIC = 'Si la cuenta permite recuperación, recibirás un enlace por correo.'

const token = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const busy = ref(false)
const error = ref('')
const message = ref('')
const done = ref(false)

const resetting = computed(() => !!token.value)
const validEmail = computed(() => required(email.value) === true && emailRule(email.value) === true)
const validPassword = computed(
  () => password.value.length >= 8 && password.value === confirmPassword.value
)

onMounted(() => {
  // El enlace del correo trae el token después de #, que no viaja al servidor ni queda en sus registros.
  const incoming = new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
  if (incoming) {
    token.value = incoming
    // Se quita de la barra de direcciones para que no quede en el historial.
    window.history.replaceState(null, '', window.location.pathname)
  }
})

async function requestLink() {
  if (busy.value || !validEmail.value) return
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    const result = await authService.forgotPassword(email.value.trim())
    // El mismo mensaje exista o no la cuenta: no se revela si el correo está registrado.
    message.value = result?.mensaje || GENERIC
    done.value = true
  } catch (failure) {
    error.value = failure.message
  } finally {
    busy.value = false
  }
}

async function resetPassword() {
  if (busy.value || !validPassword.value) return
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    const result = await authService.resetPassword({
      token: token.value,
      password: password.value,
      confirmPassword: confirmPassword.value
    })
    message.value = result?.mensaje || 'Contraseña actualizada. Inicia sesión nuevamente.'
    done.value = true
    token.value = ''
    password.value = ''
    confirmPassword.value = ''
  } catch (failure) {
    error.value = failure.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <q-page class="auth-page">
    <aside class="auth-aside">
      <div class="auth-badge"><q-icon name="lock_reset" /> Tu cuenta</div>
      <h1>Recupera tu <em>acceso.</em></h1>
      <p>Elige una contraseña nueva y vuelve a tus eventos.</p>
    </aside>

    <section class="auth-content">
      <div class="eyebrow">TU CUENTA</div>
      <h2>{{ resetting ? 'Elige tu nueva contraseña' : 'Olvidé mi contraseña' }}</h2>
      <p v-if="!done">
        {{
          resetting
            ? 'Debe tener al menos 8 caracteres.'
            : 'Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.'
        }}
      </p>

      <q-banner v-if="error" class="error" role="alert">{{ error }}</q-banner>
      <q-banner v-if="message" class="success" role="status">{{ message }}</q-banner>

      <q-form v-if="!done && !resetting" class="form-stack" @submit="requestLink">
        <q-input
          v-model="email"
          outlined
          type="email"
          label="Correo electrónico"
          autocomplete="email"
          maxlength="254"
          :rules="[required, emailRule]"
          lazy-rules
        />
        <q-btn
          type="submit"
          unelevated
          color="primary"
          no-caps
          label="Enviar enlace"
          :loading="busy"
          :disable="!validEmail"
        />
      </q-form>

      <q-form v-if="!done && resetting" class="form-stack" @submit="resetPassword">
        <q-input
          v-model="password"
          outlined
          :type="showPassword ? 'text' : 'password'"
          label="Nueva contraseña"
          autocomplete="new-password"
          maxlength="128"
          :rules="[required, (value) => value.length >= 8 || 'Usa al menos 8 caracteres.']"
          lazy-rules
        >
          <template #append>
            <q-btn
              flat
              round
              dense
              :icon="showPassword ? 'visibility_off' : 'visibility'"
              :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              @click="showPassword = !showPassword"
            />
          </template>
        </q-input>
        <q-input
          v-model="confirmPassword"
          outlined
          type="password"
          label="Confirmar contraseña"
          autocomplete="new-password"
          maxlength="128"
          :rules="[required, (value) => value === password || 'Las contraseñas deben coincidir.']"
          lazy-rules
        />
        <q-btn
          type="submit"
          unelevated
          color="primary"
          no-caps
          label="Guardar contraseña"
          :loading="busy"
          :disable="!validPassword"
        />
      </q-form>

      <p class="auth-switch">
        <router-link to="/login">Volver a iniciar sesión</router-link>
      </p>
    </section>
  </q-page>
</template>
