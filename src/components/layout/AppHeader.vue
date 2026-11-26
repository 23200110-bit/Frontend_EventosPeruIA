<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { session, signOut } from '@/stores/authStore'
import { THEME_OPTIONS, themeChoice, setTheme } from '@/utils/themeManager'

const route = useRoute()
const router = useRouter()
const menu = ref(false)

const currentTheme = computed(() => themeChoice.value)

const themeIcon = computed(() => {
  if (currentTheme.value === THEME_OPTIONS.DARK) return 'dark_mode'
  if (currentTheme.value === THEME_OPTIONS.LIGHT) return 'light_mode'
  return 'brightness_auto'
})

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

      <!-- NAVEGACIÓN DE ESCRITORIO -->
      <nav class="desktop-nav" aria-label="Navegación principal">
        <router-link to="/" exact-active-class="nav-pill-active">Inicio</router-link>

        <template v-if="session.user">
          <router-link to="/asistente" active-class="nav-pill-active">
            <q-icon name="auto_awesome" /> Asistente IA
          </router-link>
          <router-link to="/recomendaciones" active-class="nav-pill-active">Para ti</router-link>
          <router-link v-if="!session.user.isAdministrator" to="/entradas" active-class="nav-pill-active">Mis entradas</router-link>
          <!-- ANYELO MIS EVENTOS (HU-08) -->
          <router-link
            v-if="!session.user.isAdministrator"
            to="/organizador/mis-eventos"
            :class="{
              'nav-pill-active':
                route.path.startsWith('/organizador/mis-eventos') ||
                route.path.startsWith('/organizador/crear-evento') ||
                route.path.startsWith('/organizador/editar-evento')
            }"
          >
            Mis eventos
          </router-link>
          <!-- ---------------- -->
          <!-- SANTIAGO CHECK-IN -->
          <router-link v-if="!session.user.isAdministrator" to="/organizador/asistentes" active-class="nav-pill-active">Check-in Puerta</router-link>
          <!-- ---------------- -->
          <router-link to="/avisos" active-class="nav-pill-active">Avisos</router-link>
          <router-link v-if="session.user.isAdministrator" to="/admin" active-class="nav-pill-active">Admin</router-link>
        </template>

        <template v-else>
          <router-link to="/login" active-class="nav-pill-active">Iniciar sesión</router-link>
          <router-link to="/registro" active-class="nav-pill-active">Crear cuenta</router-link>
        </template>
      </nav>

      <!-- SELECTOR DE TEMA -->
      <div class="theme-selector">
        <q-btn flat round :icon="themeIcon" aria-label="Cambiar tema" class="theme-btn">
        <q-menu anchor="bottom right" self="top right" :offset="[0, 8]" auto-close>
          <q-list style="min-width: 150px">
            <q-item
              clickable
              v-ripple
              :active="currentTheme === THEME_OPTIONS.SYSTEM"
              @click="setTheme(THEME_OPTIONS.SYSTEM)"
            >
              <q-item-section avatar>
                <q-icon name="brightness_auto" />
              </q-item-section>
              <q-item-section>Sistema</q-item-section>
            </q-item>
            <q-item
              clickable
              v-ripple
              :active="currentTheme === THEME_OPTIONS.LIGHT"
              @click="setTheme(THEME_OPTIONS.LIGHT)"
            >
              <q-item-section avatar>
                <q-icon name="light_mode" />
              </q-item-section>
              <q-item-section>Claro</q-item-section>
            </q-item>
            <q-item
              clickable
              v-ripple
              :active="currentTheme === THEME_OPTIONS.DARK"
              @click="setTheme(THEME_OPTIONS.DARK)"
            >
              <q-item-section avatar>
                <q-icon name="dark_mode" />
              </q-item-section>
              <q-item-section>Oscuro</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
        </q-btn>
      </div>

      <!-- ACCIONES DE CUENTA CON SESIÓN -->
      <template v-if="session.user">
        <q-btn
          flat
          no-caps
          :label="session.user.firstName"
          to="/perfil"
          :class="{ 'nav-pill-active': route.path === '/perfil' }"
        />
        <q-btn flat no-caps label="Salir" @click="logout" />
      </template>

      <q-btn flat label="☰" aria-label="Abrir menú" class="mobile-menu" @click="menu = !menu" />
    </q-toolbar>

    <!-- NAVEGACIÓN MÓVIL -->
    <nav v-if="menu" class="mobile-links" aria-label="Navegación móvil">
      <router-link to="/" exact-active-class="nav-pill-active" @click="menu = false">Inicio</router-link>

      <template v-if="session.user">
        <router-link to="/asistente" active-class="nav-pill-active" @click="menu = false">Asistente IA</router-link>
        <router-link to="/recomendaciones" active-class="nav-pill-active" @click="menu = false">Para ti</router-link>
        <router-link to="/perfil" active-class="nav-pill-active" @click="menu = false">Perfil</router-link>
        <router-link v-if="!session.user.isAdministrator" to="/entradas" active-class="nav-pill-active" @click="menu = false">Mis entradas</router-link>
        <!-- ANYELO MIS EVENTOS (HU-08) -->
        <router-link
          v-if="!session.user.isAdministrator"
          to="/organizador/mis-eventos"
          :class="{
            'nav-pill-active':
              route.path.startsWith('/organizador/mis-eventos') ||
              route.path.startsWith('/organizador/crear-evento') ||
              route.path.startsWith('/organizador/editar-evento')
          }"
          @click="menu = false"
        >
          Mis eventos
        </router-link>
        <!-- ---------------- -->
        <!-- SANTIAGO CHECK-IN -->
        <router-link v-if="!session.user.isAdministrator" to="/organizador/asistentes" active-class="nav-pill-active" @click="menu = false">Check-in Puerta</router-link>
        <!-- ---------------- -->
        <router-link to="/avisos" active-class="nav-pill-active" @click="menu = false">Avisos</router-link>
        <router-link v-if="session.user.isAdministrator" to="/admin" active-class="nav-pill-active" @click="menu = false">Panel admin</router-link>
      </template>

      <template v-else>
        <router-link to="/login" active-class="nav-pill-active" @click="menu = false">Iniciar sesión</router-link>
        <router-link to="/registro" active-class="nav-pill-active" @click="menu = false">Crear cuenta</router-link>
      </template>
    </nav>
  </q-header>
</template>