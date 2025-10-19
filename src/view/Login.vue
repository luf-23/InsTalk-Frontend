<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../store/auth.js'
import { useUserInfoStore } from '@/store/userInfo.js'
import { loginService } from '@/api/auth.js'
import { initDynamicBackground, destroyDynamicBackground } from '@/css/dynamic-background.js'
import '@/css/dynamic-background.css'

const router = useRouter()
const authStore = useAuthStore()
const userInfoStore = useUserInfoStore()
const loginFormRef = ref()
const loading = ref(false)

// 登录表单数据
const loginForm = reactive({
  username: '',
  password: ''
})

// 表单验证规则
const loginRules = {
  username: [
    { required: true, message: '请输入用户名或邮箱', trigger: 'blur' },
    { 
      validator: (rule, value, callback) => {
        if (!value) {
          callback(new Error('请输入用户名或邮箱'))
          return
        }
        // 如果包含@，按邮箱验证
        if (value.includes('@')) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(value)) {
            callback(new Error('请输入正确的邮箱格式'))
          } else {
            callback()
          }
        } else {
          // 用户名验证：5-16位非空白字符，不能包含@
          if (!/^\S{5,16}$/.test(value)) {
            callback(new Error('用户名必须是5-16位非空白字符'))
          } else if (value.includes('@')) {
            callback(new Error('用户名不能包含@符号'))
          } else {
            callback()
          }
        }
      }, 
      trigger: 'blur' 
    }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { 
      pattern: /^\S{5,16}$/, 
      message: '密码必须是5-16位非空白字符', 
      trigger: 'blur' 
    }
  ]
}

// 处理登录
const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  try {
    const valid = await loginFormRef.value.validate()
    if (!valid) return
    
    loading.value = true
    
    // 根据用户名是否包含@来决定传入参数
    const loginData = loginForm.username.includes('@') 
      ? {
          email: loginForm.username,
          password: loginForm.password
        }
      : {
          username: loginForm.username,
          password: loginForm.password
        }
    
    const result = await loginService(loginData)
    
    authStore.setAccessToken(result.accessToken)
    authStore.setRefreshToken(result.refreshToken)
    const userInfo = {
      id: result.id,
      username: result.username,
      signature: result.signature,
      email: result.email,
      avatar: result.avatar,
      role: result.role,
      createdAt: result.createdAt
    }
    userInfoStore.setUserInfo(userInfo)

    // 跳转到主页面
    router.push('/home')
    
  } catch (error) {
    console.error('登录失败:', error)
    ElMessage.error('登录失败，请检查用户名和密码')
  } finally {
    loading.value = false
  }
}

// 跳转到注册页面
const goToRegister = () => {
  router.push('/register')
}

// 生命周期钩子
onMounted(() => {
  initDynamicBackground()
})

onUnmounted(() => {
  destroyDynamicBackground()
})

</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>InsTalk</h1>
        <p>欢迎回来，请登录您的账户</p>
      </div>
      
      <el-form 
        ref="loginFormRef" 
        :model="loginForm" 
        :rules="loginRules" 
        class="login-form"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="请输入用户名或邮箱"
            size="large"
            prefix-icon="User"
            clearable
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            prefix-icon="Lock"
            show-password
            clearable
          />
        </el-form-item>
        
        <el-form-item>
          <div class="login-options">
            <el-link type="primary" :underline="false">忘记密码？</el-link>
          </div>
        </el-form-item>
        
        <el-form-item>
          <el-button 
            type="primary" 
            size="large" 
            :loading="loading" 
            @click="handleLogin"
            class="login-button"
          >
            登录
          </el-button>
        </el-form-item>
        
        <el-form-item>
          <div class="register-link">
            <span>还没有账户？</span>
            <el-link type="primary" :underline="false" @click="goToRegister">
              立即注册
            </el-link>
          </div>
        </el-form-item>
      </el-form>
    </div>
    
    <div class="login-footer">
      <p>© 2025 InsTalk. All rights reserved.</p>
    </div>
  </div>
</template>


<style scoped>
.login-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  position: relative;
  z-index: 2;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  border-radius: 16px;
  /* 应用动态背景增强样式 */
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(25px);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: 
    0 15px 35px rgba(135, 206, 235, 0.08),
    0 5px 15px rgba(0, 0, 0, 0.04),
    0 0 0 1px rgba(255, 255, 255, 0.3) inset;
  position: relative;
  overflow: hidden;
}

.login-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(173, 216, 230, 0.5), transparent);
}

.login-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(173, 216, 230, 0.3), transparent);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 8px;
}

.login-header p {
  color: #64748b;
  font-size: 14px;
}

.login-form {
  width: 100%;
}

.login-form .el-form-item {
  margin-bottom: 24px;
}

.login-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.login-button {
  width: 100%;
  height: 44px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 8px;
}

.register-link {
  text-align: center;
  width: 100%;
  color: #64748b;
  font-size: 14px;
}

.register-link span {
  margin-right: 8px;
}

.login-footer {
  margin-top: 32px;
  text-align: center;
  color: rgba(51, 65, 85, 0.7);
  font-size: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .login-container {
    padding: 16px;
  }
  
  .login-card {
    padding: 32px 20px;
    max-width: 100%;
  }
  
  .login-header h1 {
    font-size: 24px;
  }
  
  .login-header p {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .login-card {
    padding: 28px 16px;
  }
  
  .login-header h1 {
    font-size: 22px;
  }
  
  .login-button {
    height: 44px;
  }
}

/* 输入框样式优化 */
:deep(.el-input__wrapper) {
  background-color: #f8fafc;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e2e8f0;
  transition: all 0.3s;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #cbd5e1;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #3b82f6;
}

:deep(.el-input__inner) {
  color: #334155;
  background-color: transparent;
}

:deep(.el-input__inner::placeholder) {
  color: #94a3b8;
}

:deep(.el-icon) {
  color: #64748b;
}

/* 去除浏览器自动填充时的蓝色背景 */
:deep(.el-input__inner:-webkit-autofill),
:deep(.el-input__inner:-webkit-autofill:hover),
:deep(.el-input__inner:-webkit-autofill:focus),
:deep(.el-input__inner:-webkit-autofill:active) {
  -webkit-box-shadow: 0 0 0 1000px #f8fafc inset !important;
  -webkit-text-fill-color: #334155 !important;
  background-color: #f8fafc !important;
  background-image: none !important;
  transition: background-color 5000s ease-in-out 0s;
}

/* Firefox 浏览器的自动填充样式 */
:deep(.el-input__inner:-moz-autofill) {
  background-color: #f8fafc !important;
  box-shadow: 0 0 0 1000px #f8fafc inset !important;
}

/* Edge/IE 浏览器的自动填充样式 */
:deep(.el-input__inner:-ms-input-placeholder) {
  background-color: #f8fafc !important;
}
</style>
