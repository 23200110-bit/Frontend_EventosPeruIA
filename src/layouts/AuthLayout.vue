<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <router-view :key="route.fullPath" />
    </q-page-container>
  </q-layout>
</template>