<script setup>
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppFooter from '@/components/layout/AppFooter.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { session } from '@/stores/authStore'

const route = useRoute()
const router = useRouter()

watch(
  () => session.token,
  (token) => {
    if (!token && route.meta.auth) {
      router.replace({ path: '/login', query: { next: route.fullPath } })
    }
  }
)
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <AppHeader />
    <q-page-container>
      <router-view :key="route.fullPath" />
    </q-page-container>
    <AppFooter />
  </q-layout>
</template>