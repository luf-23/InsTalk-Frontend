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

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../store/auth.js'
import { useUserInfoStore } from '@/store/userInfo.js'
import { loginService } from '@/api/auth.js'

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
    { min: 3, max: 50, message: '用户名长度在 3 到 50 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度在 6 到 20 个字符', trigger: 'blur' }
  ]
}

// 处理登录
const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  try {
    const valid = await loginFormRef.value.validate()
    if (!valid) return
    
    loading.value = true
    
    const result = await loginService({
      username: loginForm.username,
      password: loginForm.password
    })
    
    console.log("登录返回结果", result)  // 调试输出登录结果
    authStore.setAccessToken(result.accessToken)
    authStore.setRefreshToken(result.refreshToken)
    const userInfo = {
      id: result.id,
      username: result.username,
      email: result.email,
      avatar: result.avatar,
      role: result.role
    }
    userInfoStore.setUserInfo(userInfo)

    console.log("用户信息", userInfoStore.userInfo)  // 调试输出用户信息
    console.log("认证信息", authStore.accessToken)  // 调试输出认证信息
    console.log("刷新令牌", authStore.refreshToken)  // 调试输出刷新令牌

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

</script>

<style scoped>
.login-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin-bottom: 8px;
}

.login-header p {
  color: #666;
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
  color: #666;
  font-size: 14px;
}

.register-link span {
  margin-right: 8px;
}

.login-footer {
  margin-top: 32px;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .login-card {
    margin: 0 16px;
    padding: 32px 24px;
  }
  
  .login-header h1 {
    font-size: 24px;
  }
}

/* 输入框样式优化 */
:deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #dcdfe6;
  transition: all 0.3s;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c0c4cc;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #409eff;
}
</style>
