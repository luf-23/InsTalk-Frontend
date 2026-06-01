import { defineStore } from "pinia";
import { ref } from "vue";
import { checkUserOnlineService } from "@/api/websocket";
import { useUserInfoStore } from "@/store/userInfo";
import websocketService from "@/util/websocket";

export const onlineStatusStore = defineStore('onlineStatus', () => {
    const onlineUsers = ref(new Map());

    let wsOnlineStatusHandler = null;

    const registerOnlineStatusHandler = () => {
        if (wsOnlineStatusHandler) {
            return;
        }

        wsOnlineStatusHandler = (statusData) => {
            const { userId, online } = statusData;

            const userInfoStore = useUserInfoStore();
            if (userId === userInfoStore.userId) {
                return;
            }

            const currentStatus = onlineUsers.value.get(userId);

            if (online) {
                if (!currentStatus) {
                    onlineUsers.value.set(userId, true);
                    console.log(`用户 ${userId} 上线`);
                }
            } else if (currentStatus) {
                onlineUsers.value.delete(userId);
                console.log(`用户 ${userId} 下线`);
            }
        };

        websocketService.on('onlineStatus', wsOnlineStatusHandler);
    };

    /**
     * 查询单个用户在线状态并更新本地缓存
     */
    const fetchUserOnlineStatus = async (userId) => {
        const userInfoStore = useUserInfoStore();
        if (!userId || userId === userInfoStore.userId) {
            return false;
        }

        try {
            const online = await checkUserOnlineService(userId);
            if (online) {
                onlineUsers.value.set(userId, true);
            } else {
                onlineUsers.value.delete(userId);
            }
            return online;
        } catch (error) {
            console.error(`查询用户 ${userId} 在线状态失败:`, error);
            return false;
        }
    };

    /**
     * 初始化在线状态：注册 WS 监听，并按需逐个查询 userId
     * @param {Number[]} userIds - 需要查询在线状态的用户 ID 列表
     */
    const initOnlineStatus = async (userIds = []) => {
        registerOnlineStatusHandler();

        const uniqueIds = [...new Set(userIds.filter(Boolean))];
        if (uniqueIds.length === 0) {
            return;
        }

        await Promise.all(uniqueIds.map((userId) => fetchUserOnlineStatus(userId)));
        console.log('初始化在线状态完成，在线用户数:', onlineUsers.value.size);
    };

    const isUserOnline = (userId) => {
        return onlineUsers.value.has(userId) && onlineUsers.value.get(userId);
    };

    const getOnlineUserIds = () => {
        return Array.from(onlineUsers.value.keys());
    };

    const clearOnlineStatus = () => {
        if (wsOnlineStatusHandler) {
            websocketService.off('onlineStatus', wsOnlineStatusHandler);
            wsOnlineStatusHandler = null;
        }

        onlineUsers.value.clear();
    };

    return {
        onlineUsers,
        initOnlineStatus,
        fetchUserOnlineStatus,
        isUserOnline,
        getOnlineUserIds,
        clearOnlineStatus
    };
});
