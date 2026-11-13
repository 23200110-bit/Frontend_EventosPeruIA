import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import { authGuard } from './guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/pages/public/Explore.vue')
        },
        {
          path: 'explorar',
          name: 'explore',
          component: () => import('@/pages/public/Explore.vue')
        },
        {
          path: 'evento/:id',
          name: 'event-detail',
          component: () => import('@/pages/public/EventDetail.vue')
        },
        {
          path: 'login',
          name: 'login',
          component: () => import('@/pages/auth/Auth.vue')
        },
        {
          path: 'registro',
          name: 'register',
          component: () => import('@/pages/auth/Auth.vue')
        },
        {
          path: 'perfil',
          name: 'profile',
          component: () => import('@/pages/user/Profile.vue'),
          meta: { auth: true }
        },
        {
          path: 'recomendaciones',
          name: 'recommendations',
          component: () => import('@/pages/user/Recommendations.vue'),
          meta: { auth: true }
        },
        {
          path: 'asistente',
          name: 'assistant',
          component: () => import('@/pages/public/AIAssistant.vue'),
          meta: { auth: true }
        },
        {
          path: 'entradas',
          name: 'tickets',
          component: () => import('@/pages/user/MyTickets.vue'),
          meta: { auth: true }
        },
        {
          path: 'avisos',
          name: 'notifications',
          component: () => import('@/pages/user/Notifications.vue'),
          meta: { auth: true }
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

router.beforeEach(authGuard)

export default router