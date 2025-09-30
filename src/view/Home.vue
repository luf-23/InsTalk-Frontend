<script setup>
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '../store/auth.js'
import { useUserInfoStore } from '../store/userInfo.js'

const router = useRouter()
const authStore = useAuthStore()
const userInfoStore = useUserInfoStore()

// 处理退出登录
const handleLogout = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要退出登录吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    // 清除 Pinia store 中的认证信息
    authStore.clearAuth()
    userInfoStore.clearUserInfo();
    
    
    // 清除本地存储的登录信息
    
    ElMessage.success('已成功退出登录')
    
    // 跳转到登录页
    router.push('/login')
  } catch {
    // 用户取消退出
  }
}
</script>

<template>
  <div class="home-container">
    <div class="header">
      <div class="header-content">
        <h1>InsTalk</h1>
        <div class="user-menu">
          <span class="username">欢迎回来！</span>
          <el-button type="primary" @click="handleLogout">退出登录</el-button>
        </div>
      </div>
    </div>
    
    <div class="main-content">
      <div class="welcome-section">
        <h2>欢迎来到 InsTalk</h2>
        <p>这里是您的聊天主页面</p>
        <el-button type="primary" size="large">开始聊天</el-button>
      </div>
    </div>
  </div>
</template>


<style scoped>
.home-container {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.header {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 0 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  max-width: 1200px;
  margin: 0 auto;
}

.header h1 {
  color: #409eff;
  font-size: 24px;
  font-weight: 700;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 16px;
}

.username {
  color: #666;
  font-size: 14px;
}

.main-content {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 60px);
  padding: 40px;
}

.welcome-section {
  text-align: center;
  background: white;
  padding: 60px 40px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
}

.welcome-section h2 {
  font-size: 32px;
  color: #333;
  margin-bottom: 16px;
}

.welcome-section p {
  color: #666;
  font-size: 16px;
  margin-bottom: 32px;
}
</style>