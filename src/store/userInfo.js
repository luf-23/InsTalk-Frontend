import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useUserInfoStore = defineStore(
  "userInfo",
  () => {
    // 用户信息
    const userInfo = ref(null);
    
    // 计算属性：检查是否有用户信息
    const hasUserInfo = computed(() => !!userInfo.value);
    
    // 获取用户ID
    const userId = computed(() => userInfo.value?.id || null);
    
    // 获取用户名
    const username = computed(() => userInfo.value?.username || '');
    
    // 获取用户头像
    const avatar = computed(() => userInfo.value?.avatar || '');
    
    // 获取用户邮箱
    const email = computed(() => userInfo.value?.email || '');

    // 获取用户角色
    const role = computed(() => userInfo.value?.role || 'user');
    
    // 设置用户信息
    const setUserInfo = (info) => {
      userInfo.value = info;
    };
    
    // 更新用户信息（部分更新）
    const updateUserInfo = (updates) => {
      if (userInfo.value) {
        userInfo.value = { ...userInfo.value, ...updates };
      }
    };
    
    // 清除用户信息
    const clearUserInfo = () => {
      userInfo.value = null;
    };
    
    return {
      // 状态
      userInfo,
      
      // 计算属性
      hasUserInfo,
      userId,
      username,
      avatar,
      email,
      role,
      
      // 方法
      setUserInfo,
      updateUserInfo,
      clearUserInfo
    };
  },
  {
    // 持久化存储
    persist: {
      key: 'user-info-store',
      storage: localStorage
    }
  }
);