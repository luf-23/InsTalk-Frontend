import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '../store/auth.js'
// 导入页面组件
const Login = () => import('../view/Login.vue')

// 定义路由配置
const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: {
      title: '登录 - InsTalk',
      requiresAuth: false
    }
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../view/Home.vue'),
    meta: {
      title: '首页 - InsTalk',
      requiresAuth: true
    }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../view/Register.vue'),
    meta: {
      title: '注册 - InsTalk',
      requiresAuth: false
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../view/NotFound.vue'),
    meta: {
      title: '页面未找到 - InsTalk'
    }
  }
]

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  }
})

// 路由前置守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  if (to.meta.title) {
    document.title = to.meta.title
  }
  
  // 检查是否需要认证
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  
  const authStore = useAuthStore()
  const isAuthenticated = authStore.isAuthenticated

  if (requiresAuth && !isAuthenticated) {
    // 需要认证但未登录，重定向到登录页
    next({ path: '/login', query: { redirect: to.fullPath } })
  } else if (to.path === '/login' && isAuthenticated) {
    // 已登录用户访问登录页，重定向到首页
    next('/home')
  } else {
    next()
  }
})


export default router