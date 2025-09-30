<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getCaptchaService, registerService } from '@/api/auth'

const router = useRouter()
const registerFormRef = ref()
const loading = ref(false)
const agreeTerms = ref(false)

// 注册表单数据
const registerForm = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  captcha: ''
})

// 验证码相关状态
const captchaLoading = ref(false)
const countdown = ref(0)
const canGetCaptcha = ref(true)

// 验证确认密码
const validateConfirmPassword = (rule, value, callback) => {
  if (value !== registerForm.password) {
    callback(new Error('两次输入密码不一致'))
  } else {
    callback()
  }
}

// 表单验证规则
const registerRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { 
      pattern: /^\S{5,16}$/, 
      message: '用户名必须是5-16位非空白字符', 
      trigger: 'blur' 
    },
    { 
      validator: (rule, value, callback) => {
        if (value && value.includes('@')) {
          callback(new Error('用户名不能包含@符号'))
        } else {
          callback()
        }
      }, 
      trigger: 'blur' 
    }
  ],
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { 
      pattern: /^\S{5,16}$/, 
      message: '密码必须是5-16位非空白字符', 
      trigger: 'blur' 
    }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ],
  captcha: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码必须是6位', trigger: 'blur' }
  ]
}

// 获取验证码
const getCaptcha = async () => {
  if (!registerForm.email) {
    ElMessage.warning('请先输入邮箱地址')
    return
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerForm.email)) {
    ElMessage.warning('请输入正确的邮箱格式')
    return
  }
  
  if (!canGetCaptcha.value) {
    return
  }
  
  try {
    captchaLoading.value = true
    
    await getCaptchaService({
      email: registerForm.email
    })
    
    ElMessage.success('验证码已发送到您的邮箱')
    
    // 开始60秒倒计时
    startCountdown()
    
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '获取验证码失败，请稍后重试')
  } finally {
    captchaLoading.value = false
  }
}

// 开始倒计时
const startCountdown = () => {
  canGetCaptcha.value = false
  countdown.value = 60
  
  const timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
      canGetCaptcha.value = true
      countdown.value = 0
    }
  }, 1000)
}

// 处理注册
const handleRegister = async () => {
  if (!registerFormRef.value) return
  
  if (!agreeTerms.value) {
    ElMessage.warning('请先同意用户协议和隐私政策')
    return
  }
  
  try {
    const valid = await registerFormRef.value.validate()
    if (!valid) return
    
    loading.value = true

    // 调用注册接口
    await registerService({
      username: registerForm.username,
      email: registerForm.email,
      password: registerForm.password,
      captcha: registerForm.captcha
    })
    
    ElMessage.success('注册成功！请登录您的账户')
    
    // 跳转到登录页面
    router.push('/login')  } catch (error) {
    ElMessage.error('注册失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 跳转到登录页面
const goToLogin = () => {
  router.push('/login')
}
</script>

<template>
  <div class="register-container">
    <div class="register-card">
      <div class="register-header">
        <h1>InsTalk</h1>
        <p>创建您的新账户</p>
      </div>
      
      <el-form 
        ref="registerFormRef" 
        :model="registerForm" 
        :rules="registerRules" 
        class="register-form"
        @keyup.enter="handleRegister"
      >
        <el-form-item prop="username">
          <el-input
            v-model="registerForm.username"
            placeholder="请输入用户名"
            size="large"
            prefix-icon="User"
            clearable
          />
        </el-form-item>
        
        <el-form-item prop="email">
          <el-input
            v-model="registerForm.email"
            placeholder="请输入邮箱地址"
            size="large"
            prefix-icon="Message"
            clearable
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input
            v-model="registerForm.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            prefix-icon="Lock"
            show-password
            clearable
          />
        </el-form-item>
        
        <el-form-item prop="confirmPassword">
          <el-input
            v-model="registerForm.confirmPassword"
            type="password"
            placeholder="请确认密码"
            size="large"
            prefix-icon="Lock"
            show-password
            clearable
          />
        </el-form-item>
        
        <el-form-item prop="captcha">
          <div class="captcha-input-group">
            <el-input
              v-model="registerForm.captcha"
              placeholder="请输入邮箱验证码"
              size="large"
              prefix-icon="ChatDotRound"
              clearable
              maxlength="6"
              class="captcha-input"
            />
            <el-button
              type="primary"
              size="large"
              :loading="captchaLoading"
              :disabled="!canGetCaptcha || !registerForm.email"
              @click="getCaptcha"
              class="captcha-button"
            >
              {{ canGetCaptcha ? '获取验证码' : `${countdown}s后重试` }}
            </el-button>
          </div>
        </el-form-item>
        
        <el-form-item>
          <div class="agreement">
            <el-checkbox v-model="agreeTerms" required>
              我已阅读并同意
              <el-link type="primary" :underline="false">用户协议</el-link>
              和
              <el-link type="primary" :underline="false">隐私政策</el-link>
            </el-checkbox>
          </div>
        </el-form-item>
        
        <el-form-item>
          <el-button 
            type="primary" 
            size="large" 
            :loading="loading" 
            @click="handleRegister"
            class="register-button"
            :disabled="!agreeTerms"
          >
            注册
          </el-button>
        </el-form-item>
        
        <el-form-item>
          <div class="login-link">
            <span>已有账户？</span>
            <el-link type="primary" :underline="false" @click="goToLogin">
              立即登录
            </el-link>
          </div>
        </el-form-item>
      </el-form>
    </div>
    
    <div class="register-footer">
      <p>© 2025 InsTalk. All rights reserved.</p>
    </div>
  </div>
</template>

<style scoped>
.register-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%);
  padding: 20px;
}

.register-card {
  width: 100%;
  max-width: 450px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 40px rgba(148, 163, 184, 0.1);
  backdrop-filter: blur(10px);
}

.register-header {
  text-align: center;
  margin-bottom: 32px;
}

.register-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 8px;
}

.register-header p {
  color: #64748b;
  font-size: 14px;
}

.register-form {
  width: 100%;
}

.register-form .el-form-item {
  margin-bottom: 24px;
}

.agreement {
  width: 100%;
  font-size: 14px;
  color: #64748b;
}

.register-button {
  width: 100%;
  height: 44px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 8px;
}

.login-link {
  text-align: center;
  width: 100%;
  color: #64748b;
  font-size: 14px;
}

.login-link span {
  margin-right: 8px;
}

.captcha-input-group {
  display: flex;
  gap: 12px;
  width: 100%;
}

.captcha-input {
  flex: 1;
}

.captcha-button {
  width: 120px;
  white-space: nowrap;
  font-size: 14px;
}

.register-footer {
  margin-top: 32px;
  text-align: center;
  color: rgba(51, 65, 85, 0.7);
  font-size: 12px;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .register-card {
    margin: 0 16px;
    padding: 32px 24px;
  }
  
  .register-header h1 {
    font-size: 24px;
  }
  
  .captcha-input-group {
    flex-direction: column;
    gap: 8px;
  }
  
  .captcha-button {
    width: 100%;
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

:deep(.el-checkbox__label) {
  font-size: 14px;
  color: #64748b;
}

:deep(.el-checkbox__inner) {
  background-color: #ffffff;
  border-color: #cbd5e1;
}

:deep(.el-checkbox__inner:hover) {
  border-color: #3b82f6;
}
</style>