<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ChatSidebar from '@/components/ChatSidebar.vue';
import ChatWindow from '@/components/ChatWindow.vue';
import { friendshipStore } from '@/store/friendship';
import { groupStore } from '@/store/group';
import { messageStore } from '@/store/message';
import { conversationStore } from '@/store/conversation';

const router = useRouter();
const friendStore = friendshipStore();
const gStore = groupStore();
const msgStore = messageStore();
const convStore = conversationStore();

// 响应式断点
const isMobile = ref(window.innerWidth < 768);

// 移动端视图状态：'list' 显示列表，'chat' 显示聊天
const mobileView = ref('list');

// 监听窗口大小变化
const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
  // 桌面端始终显示列表
  if (!isMobile.value) {
    mobileView.value = 'list';
  }
};

// 监听会话选择事件（从 ChatSidebar 触发）
const handleChatSelected = () => {
  if (isMobile.value) {
    mobileView.value = 'chat';
  }
};

// 监听返回列表事件（从 ChatWindow 触发）
const handleBackToList = () => {
  if (isMobile.value) {
    mobileView.value = 'list';
  }
};

// 监听当前会话变化
watch(() => convStore.currentConversation, (newVal) => {
  if (newVal && isMobile.value) {
    mobileView.value = 'chat';
  }
});

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
  
  // 从消息同步会话列表（初始化或恢复会话）
  convStore.syncConversationsFromMessages();

  // 启动好友和申请列表轮询（30秒间隔）
  friendStore.startPolling();
  
  // 启动群组列表轮询（30秒间隔）
  gStore.startPolling();

  // 添加窗口大小变化监听
  window.addEventListener('resize', handleResize);
  // 添加移动端事件监听
  window.addEventListener('chat-selected', handleChatSelected);
  window.addEventListener('back-to-list', handleBackToList);
  handleResize();
});

// 组件卸载时清理资源
onUnmounted(() => {
  // 停止所有轮询
  msgStore.stopPolling();
  friendStore.stopPolling();
  gStore.stopPolling();
  
  // 移除事件监听
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('chat-selected', handleChatSelected);
  window.removeEventListener('back-to-list', handleBackToList);
});
</script>

<template>
  <div class="home-container">
    <div class="chat-layout">
      <!-- 侧边栏 - 移动端根据视图状态显示/隐藏 -->
      <div 
        class="sidebar-container"
        :class="{ 'mobile-hidden': isMobile && mobileView === 'chat' }"
      >
        <ChatSidebar />
      </div>
      
      <!-- 聊天窗口 - 移动端根据视图状态显示/隐藏 -->
      <div 
        class="window-container"
        :class="{ 'mobile-visible': isMobile && mobileView === 'chat' }"
      >
        <ChatWindow :is-mobile="isMobile" :mobile-view="mobileView" />
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
  background-color: #fff;
}

.window-container {
  flex: 1;
  height: 100%;
  overflow: hidden;
}

/* 移动端适配 - QQ风格 (≤768px) */
@media (max-width: 768px) {
  .home-container {
    /* 使用 dvh (动态视口高度) 来处理移动端键盘弹出问题 */
    height: 100dvh;
    height: 100vh;
  }
  
  .sidebar-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    z-index: 1;
    border-right: none;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* 移动端隐藏侧边栏 */
  .sidebar-container.mobile-hidden {
    transform: translateX(-100%);
  }
  
  .window-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    z-index: 0;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }
  
  /* 移动端显示聊天窗口 */
  .window-container.mobile-visible {
    transform: translateX(0);
    z-index: 2;
  }
}

/* 小屏幕设备 (≤480px) */
@media (max-width: 480px) {
  .sidebar-container,
  .window-container {
    width: 100%;
  }
}
</style>