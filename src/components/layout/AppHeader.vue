<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { session, signOut } from '@/stores/authStore'

const router = useRouter()
const menu = ref(false)

function logout() {
  menu.value = false
  signOut()
  router.push('/login')
}
</script>

<template>
  <q-header class="topbar">
    <q-toolbar class="toolbar">
      <router-link to="/" class="brand">
        <span class="brand-mark">e.</span> eventos<span class="brand-peru">perú</span><small>IA</small>
      </router-link>

      <q-space />

      <nav class="desktop-nav" aria-label="Navegación principal">
        <router-link to="/explorar">Explorar eventos</router-link>
        <router-link to="/asistente"><q-icon name="auto_awesome" /> Asistente IA</router-link>
        <router-link v-if="session.user" to="/recomendaciones">Para ti</router-link>
        <router-link v-if="session.user" to="/entradas">Mis entradas</router-link>
        <!-- SANTIAGO CHECK-IN -->
        <router-link v-if="session.user" to="/organizador/asistentes">Check-in Puerta</router-link>
        <!-- ---------------- -->
        <router-link v-if="session.user" to="/avisos">Avisos</router-link>
      </nav>

      <q-btn v-if="!session.user" flat no-caps label="Iniciar sesión" to="/login" class="desktop-nav" />
      <q-btn v-if="!session.user" unelevated color="primary" no-caps label="Crear cuenta" to="/registro" />
      <q-btn v-if="session.user" flat no-caps :label="session.user.firstName" to="/perfil" />
      <q-btn v-if="session.user" flat no-caps label="Salir" @click="logout" />
      <q-btn flat label="☰" aria-label="Abrir menú" class="mobile-menu" @click="menu = !menu" />
    </q-toolbar>

    <nav v-if="menu" class="mobile-links" aria-label="Navegación móvil">
      <router-link to="/explorar" @click="menu = false">Explorar</router-link>
      <router-link to="/asistente" @click="menu = false">Asistente IA</router-link>
      <template v-if="session.user">
        <router-link to="/recomendaciones" @click="menu = false">Para ti</router-link>
        <router-link to="/perfil" @click="menu = false">Perfil</router-link>
        <router-link to="/entradas" @click="menu = false">Mis entradas</router-link>
        <!-- SANTIAGO CHECK-IN -->
        <router-link to="/organizador/asistentes" @click="menu = false">Check-in Puerta</router-link>
        <!-- ---------------- -->
        <router-link to="/avisos" @click="menu = false">Avisos</router-link>
      </template>
      <router-link v-else to="/login" @click="menu = false">Iniciar sesión</router-link>
    </nav>
  </q-header>
</template>