<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, ChatDotRound } from '@element-plus/icons-vue';
import ChatSidebar from '@/components/ChatSidebar.vue';
import ChatWindow from '@/components/ChatWindow.vue';
import { friendshipStore } from '@/store/friendship';
import { groupStore } from '@/store/group';
import { messageStore } from '@/store/message';

const router = useRouter();
const friendStore = friendshipStore();
const gStore = groupStore();
const msgStore = messageStore();

// 当前活动面板
const activeSidebar = ref(true);

// 在移动设备上切换侧边栏
const toggleSidebar = () => {
  activeSidebar.value = !activeSidebar.value;
};

// 响应式断点
const isMobile = ref(window.innerWidth < 768);

// 监听窗口大小变化
const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
  if (!isMobile.value) {
    activeSidebar.value = true;
  }
};

// 生命周期钩子
onMounted(async () => {
  // 初始化数据
  await Promise.all([
    friendStore.fetchFriendList(),
    friendStore.fetchPendingRequests(),
    gStore.fetchAllGroups(),
    gStore.fetchMyGroups()
  ]);

  // 智能初始化消息（自动判断是否需要从服务器获取）
  await msgStore.initMessages();

  // 添加窗口大小变化监听
  window.addEventListener('resize', handleResize);
  handleResize();
});

// 组件卸载时清理资源
onUnmounted(() => {
  // 停止消息轮询
  msgStore.stopPolling();
  
  // 移除窗口大小变化监听
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div class="home-container">
    <!-- 移动设备切换按钮 -->
    <button 
      v-if="isMobile" 
      class="mobile-toggle"
      @click="toggleSidebar"
    >
      <el-icon v-if="activeSidebar"><ArrowRight /></el-icon>
      <el-icon v-else><ChatDotRound /></el-icon>
    </button>
    
    <div class="chat-layout">
      <!-- 侧边栏 -->
      <div 
        class="sidebar-container"
        :class="{ 'active': activeSidebar || !isMobile, 'mobile': isMobile }"
      >
        <ChatSidebar />
      </div>
      
      <!-- 聊天窗口 -->
      <div 
        class="window-container"
        :class="{ 'active': !activeSidebar || !isMobile, 'mobile': isMobile }"
      >
        <ChatWindow />
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  position: relative;
}

.chat-layout {
  display: flex;
  height: 100%;
  width: 100%;
}

.sidebar-container {
  width: 320px;
  height: 100%;
  border-right: 1px solid var(--el-border-color-light);
  overflow: hidden;
}

.window-container {
  flex: 1;
  height: 100%;
  overflow: hidden;
}

/* 移动设备样式 */
.mobile-toggle {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--el-color-primary);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.mobile.sidebar-container {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  z-index: 999;
  transition: left 0.3s ease;
}

.mobile.sidebar-container.active {
  left: 0;
}

.mobile.window-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 1;
  z-index: 900;
  transition: opacity 0.3s ease;
}

.mobile.window-container.active {
  opacity: 1;
}

@media (max-width: 768px) {
  .sidebar-container {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    z-index: 999;
    transition: left 0.3s ease;
  }

  .sidebar-container.active {
    left: 0;
  }

  .window-container {
    width: 100%;
  }
}
</style>