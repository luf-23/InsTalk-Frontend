<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}

const goBack = () => {
  router.back()
}
</script>

<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <div class="error-code">404</div>
      <h1>页面未找到</h1>
      <p>抱歉，您访问的页面不存在或已被移动</p>
      <div class="actions">
        <el-button type="primary" @click="goHome">返回首页</el-button>
        <el-button @click="goBack">返回上一页</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.not-found-content {
  text-align: center;
  color: white;
}

.error-code {
  font-size: 120px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1;
  margin-bottom: 20px;
}

h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 16px;
}

p {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 32px;
  max-width: 400px;
}

.actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .not-found-container {
    padding: 16px;
  }
  
  .error-code {
    font-size: 100px;
  }
  
  h1 {
    font-size: 28px;
  }
  
  p {
    font-size: 15px;
  }
}

@media (max-width: 480px) {
  .error-code {
    font-size: 80px;
  }
  
  h1 {
    font-size: 24px;
  }
  
  p {
    font-size: 14px;
  }
  
  .actions {
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  
  .actions .el-button {
    width: 200px;
    height: var(--mobile-button-height, 44px);
  }
}
</style>