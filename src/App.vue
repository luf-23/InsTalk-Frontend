<script setup>
// App.vue - 应用根组件
import '@/css/mobile.css'
import '@/css/dialog-mobile.css'
</script>

<template>
  <div id="app">
    <!-- 路由视图容器 -->
    <router-view />
  </div>
</template>

<style>
#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  background-color: #f5f5f5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 优化移动端字体渲染 */
@media (max-width: 768px) {
  body {
    font-size: 14px;
    line-height: 1.5;
  }
  
  #app {
    overflow-x: hidden;
  }
}
</style>