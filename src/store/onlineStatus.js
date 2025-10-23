import { defineStore } from "pinia";
import { ref } from "vue";
import { getAllOnlineUsersService } from "@/api/websocket";
import { useUserInfoStore } from "@/store/userInfo";
import websocketService from "@/util/websocket";

export const onlineStatusStore = defineStore('onlineStatus', () => {
    // 在线用户映射 <userId, boolean>
    const onlineUsers = ref(new Map());
    
    // WebSocket 在线状态处理器
    let wsOnlineStatusHandler = null;

    /**
     * 初始化在线状态
     */
    const initOnlineStatus = async () => {
        try {
            // 从服务器获取初始在线状态
            const onlineData = await getAllOnlineUsersService();
            
            if (onlineData) {
                const userInfoStore = useUserInfoStore();
                const currentUserId = userInfoStore.userId;
                
                // 过滤掉自己，只保存其他用户的在线状态
                const entries = Object.entries(onlineData)
                    .map(([key, value]) => [parseInt(key), value])
                    .filter(([userId]) => userId !== currentUserId);
                
                onlineUsers.value = new Map(entries);
                console.log('初始化在线状态成功，在线用户数:', onlineUsers.value.size);
            }
        } catch (error) {
            console.error('初始化在线状态失败:', error);
        }

        // 注册 WebSocket 在线状态处理器
        wsOnlineStatusHandler = (statusData) => {
            const { userId, online } = statusData;
            
            // 忽略自己的在线状态更新
            const userInfoStore = useUserInfoStore();
            if (userId === userInfoStore.userId) {
                return;
            }
            
            // 检查状态是否真的改变，避免不必要的更新
            const currentStatus = onlineUsers.value.get(userId);
            
            if (online) {
                // 只有在状态真的改变时才更新
                if (!currentStatus) {
                    onlineUsers.value.set(userId, true);
                    console.log(`用户 ${userId} 上线`);
                }
            } else {
                // 只有在用户确实在线时才删除
                if (currentStatus) {
                    onlineUsers.value.delete(userId);
                    console.log(`用户 ${userId} 下线`);
                }
            }
        };

        websocketService.on('onlineStatus', wsOnlineStatusHandler);
    };

    /**
     * 检查用户是否在线
     * @param {Number} userId - 用户 ID
     * @returns {Boolean} 是否在线
     */
    const isUserOnline = (userId) => {
        return onlineUsers.value.has(userId) && onlineUsers.value.get(userId);
    };

    /**
     * 获取所有在线用户 ID
     * @returns {Array} 在线用户 ID 列表
     */
    const getOnlineUserIds = () => {
        return Array.from(onlineUsers.value.keys());
    };

    /**
     * 清空在线状态数据
     */
    const clearOnlineStatus = () => {
        // 移除处理器
        if (wsOnlineStatusHandler) {
            websocketService.off('onlineStatus', wsOnlineStatusHandler);
            wsOnlineStatusHandler = null;
        }

        onlineUsers.value.clear();
    };

    return {
        onlineUsers,
        initOnlineStatus,
        isUserOnline,
        getOnlineUserIds,
        clearOnlineStatus
    };
});
