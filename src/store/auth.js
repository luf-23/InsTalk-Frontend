import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { friendshipStore } from "./friendship";
import { groupStore } from "./group";
import { messageStore } from "./message";

export const useAuthStore = defineStore(
  "auth",
  () => {
    // accessToken 存储在内存中，不持久化
    const accessToken = ref(null);
    
    // refreshToken 持久化存储
    const refreshToken = ref(null);
    
    // 计算属性：检查是否已登录
    const isAuthenticated = computed(() => !!accessToken.value);
    
    // 设置tokens
    const setTokens = (access, refresh) => {
      accessToken.value = access;
      refreshToken.value = refresh;
    };
    
    // 设置访问token
    const setAccessToken = (token) => {
      accessToken.value = token;
    };
    
    // 设置刷新token
    const setRefreshToken = (token) => {
      refreshToken.value = token;
    };
    
    // 清除所有认证信息
    const clearAuth = () => {
      accessToken.value = null;
      refreshToken.value = null;
      
      // 清理好友、群组和消息数据
      const friendStore = friendshipStore();
      const groupData = groupStore();
      const msgStore = messageStore();
      friendStore.clearFriendshipData();
      groupData.clearGroupData();
      msgStore.clearMessageData();
    };
    
    // 只清除accessToken（用于token过期时）
    const clearAccessToken = () => {
      accessToken.value = null;
    };
    
    return {
      // 状态
      accessToken,
      refreshToken,
      isAuthenticated,
      
      // 方法
      setTokens,
      setAccessToken,
      setRefreshToken,
      clearAuth,
      clearAccessToken
    };
  },
  {
    // 只持久化 refreshToken，不持久化 accessToken
    persist: {
      key: 'auth-store',
      storage: localStorage,
      paths: ['refreshToken']
    }
  }
);
