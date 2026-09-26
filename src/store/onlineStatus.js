import { defineStore } from "pinia";
import { ref } from "vue";
import { batchCheckUserOnlineService } from "@/api/websocket";
import { useUserInfoStore } from "@/store/userInfo";

export const onlineStatusStore = defineStore('onlineStatus', () => {
    const onlineUsers = ref(new Map());
    let pollingTimer = null;

    const refreshOnlineStatus = async (userIds = []) => {
        const userInfoStore = useUserInfoStore();
        const uniqueIds = [...new Set(userIds.filter((id) => id && id !== userInfoStore.userId))];
        if (uniqueIds.length === 0) {
            onlineUsers.value.clear();
            return;
        }

        try {
            const statuses = await batchCheckUserOnlineService(uniqueIds);
            const nextOnlineUsers = new Map();
            Object.entries(statuses || {}).forEach(([userId, online]) => {
                if (online) {
                    nextOnlineUsers.set(Number(userId), true);
                }
            });
            onlineUsers.value = nextOnlineUsers;
        } catch (error) {
            console.error('批量查询用户在线状态失败:', error);
        }
    };

    /**
    * 初始化在线状态并启动轮询
     * @param {Number[]} userIds - 需要查询在线状态的用户 ID 列表
     */
    const initOnlineStatus = async (userIds = []) => {
        await refreshOnlineStatus(userIds);
        console.log('初始化在线状态完成，在线用户数:', onlineUsers.value.size);
    };

    const startPolling = (getUserIds, interval = 90000) => {
        stopPolling();
        const refresh = () => {
            if (!document.hidden) {
                refreshOnlineStatus(getUserIds());
            }
        };
        refresh();
        pollingTimer = setInterval(refresh, interval);
    };

    const stopPolling = () => {
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
        }
    };

    const isUserOnline = (userId) => {
        return onlineUsers.value.has(userId) && onlineUsers.value.get(userId);
    };

    const getOnlineUserIds = () => {
        return Array.from(onlineUsers.value.keys());
    };

    const clearOnlineStatus = () => {
        stopPolling();
        onlineUsers.value.clear();
    };

    return {
        onlineUsers,
        initOnlineStatus,
        refreshOnlineStatus,
        startPolling,
        stopPolling,
        isUserOnline,
        getOnlineUserIds,
        clearOnlineStatus
    };
});
