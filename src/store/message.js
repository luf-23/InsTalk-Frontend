import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { sendMessageService, getMessageHistoryService } from "@/api/message";
import { useUserInfoStore } from "@/store/userInfo";
import { ElMessage } from "element-plus";

export const messageStore = defineStore('message', () => {
    // 存储所有消息列表
    const messages = ref([]);
    // 当前选中的聊天对象/群组：groupId或userId
    const currentChat = ref(null);
    // 当前聊天类型：'friend' | 'group'
    const chatType = ref('friend');
    // 加载状态
    const loading = ref({
        messages: false,
        send: false
    });

    // 获取消息历史
    const fetchMessageHistory = async () => {
        loading.value.messages = true;
        try {
            const data = await getMessageHistoryService();
            messages.value = data || [];
        } catch (error) {
            console.error('获取消息历史失败:', error);
            ElMessage.error('获取消息历史失败');
        } finally {
            loading.value.messages = false;
        }
    };

    // 发送消息
    const sendMessage = async (messageData) => {
        loading.value.send = true;
        try {
            await sendMessageService(messageData);
            // 重新获取消息历史以更新界面
            await fetchMessageHistory();
            return true;
        } catch (error) {
            console.error('发送消息失败:', error);
            ElMessage.error('发送消息失败');
            return false;
        } finally {
            loading.value.send = false;
        }
    };

    // 设置当前聊天对象
    const setCurrentChat = (chat, type = 'friend') => {
        currentChat.value = chat;
        chatType.value = type;
    };

    // 获取当前聊天的消息
    const getCurrentChatMessages = computed(() => {
        if (!currentChat.value) return [];
        
        return messages.value.filter(message => {
            if (chatType.value === 'friend') {
                return (
                    (message.senderId === currentChat.value.id || message.receiverId === currentChat.value.id) &&
                    !message.groupId
                );
            } else if (chatType.value === 'group') {
                return message.groupId === currentChat.value.id;
            }
            return false;
        }).sort((a, b) => new Date(a.sendAt) - new Date(b.sendAt));
    });

    // 获取聊天列表（最近的对话）
    const getChatList = computed(() => {
        const chatMap = new Map();
        
        messages.value.forEach(message => {
            let chatKey, chatInfo;
            
            if (message.groupId) {
                // 群组消息
                chatKey = `group_${message.groupId}`;
                if (!chatMap.has(chatKey)) {
                    chatInfo = {
                        id: message.groupId,
                        type: 'group',
                        name: `群组 ${message.groupId}`, // 这里可以从群组store获取实际名称
                        lastMessage: message,
                        lastMessageTime: message.sendAt,
                        unreadCount: 0
                    };
                }
            } else {
                // 私人消息
                const otherId = message.senderId === getCurrentUserId() ? message.receiverId : message.senderId;
                chatKey = `friend_${otherId}`;
                if (!chatMap.has(chatKey)) {
                    chatInfo = {
                        id: otherId,
                        type: 'friend',
                        name: `用户 ${otherId}`, // 这里可以从好友store获取实际昵称
                        lastMessage: message,
                        lastMessageTime: message.sendAt,
                        unreadCount: 0
                    };
                }
            }
            
            if (chatInfo) {
                const existing = chatMap.get(chatKey);
                if (!existing || new Date(message.sendAt) > new Date(existing.lastMessageTime)) {
                    chatMap.set(chatKey, {
                        ...chatInfo,
                        lastMessage: message,
                        lastMessageTime: message.sendAt
                    });
                }
            }
        });
        
        return Array.from(chatMap.values()).sort((a, b) => 
            new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
        );
    });

    // 获取当前用户ID
    const getCurrentUserId = () => {
        const userInfoStore = useUserInfoStore();
        return userInfoStore.userInfo?.id || null;
    };

    // 清空所有数据（用于退出登录时）
    const clearMessageData = () => {
        messages.value = [];
        currentChat.value = null;
        chatType.value = 'friend';
        loading.value = {
            messages: false,
            send: false
        };
    };

    return {
        messages,
        currentChat,
        chatType,
        loading,
        fetchMessageHistory,
        sendMessage,
        setCurrentChat,
        getCurrentChatMessages,
        getChatList,
        clearMessageData
    };
});
