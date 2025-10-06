import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { sendMessageService, getMessageHistoryService } from "@/api/message";
import { useUserInfoStore } from "@/store/userInfo";
import { ElMessage } from "element-plus";

// 时间比较辅助函数
const getTimeForComparison = (timeString) => {
  if (!timeString) return 0;
  
  // 处理标准日期时间格式
  const date = new Date(timeString);
  return isNaN(date.getTime()) ? 0 : date.getTime();
};

export const messageStore = defineStore('message', () => {
    // 存储所有和我有关的消息列表
    const messages = ref([]);
    // 当前选中的聊天对象/群组
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
        }).sort((a, b) => getTimeForComparison(a.sendAt) - getTimeForComparison(b.sendAt));
    });

    // 获取聊天列表（最近的对话）
    const getChatList = computed(() => {
            const chatMap = new Map();
            // 先按时间升序排序，保证后面覆盖的是最新的
            const sortedMessages = [...messages.value].sort((a, b) => getTimeForComparison(a.sendAt) - getTimeForComparison(b.sendAt));
            sortedMessages.forEach(message => {
                let chatKey, chatInfo;
                if (message.groupId) {
                    chatKey = `group_${message.groupId}`;
                    chatInfo = chatMap.get(chatKey) || {
                        id: message.groupId,
                        type: 'group',
                        name: `群组 ${message.groupId}`,
                        lastMessage: null,
                        lastMessageTime: null,
                        unreadCount: 0
                    };
                } else {
                    const otherId = message.senderId === getCurrentUserId() ? message.receiverId : message.senderId;
                    chatKey = `friend_${otherId}`;
                    chatInfo = chatMap.get(chatKey) || {
                        id: otherId,
                        type: 'friend',
                        name: `用户 ${otherId}`,
                        lastMessage: null,
                        lastMessageTime: null,
                        unreadCount: 0
                    };
                }
                // 始终用最新的消息覆盖
                chatMap.set(chatKey, {
                    ...chatInfo,
                    lastMessage: message,
                    lastMessageTime: message.sendAt
                });
            });
            return Array.from(chatMap.values()).sort((a, b) =>
                getTimeForComparison(b.lastMessageTime) - getTimeForComparison(a.lastMessageTime)
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

    // 添加临时消息到列表
    const addTempMessage = (message) => {
        messages.value.push(message);
    };
    
    // 更新临时消息状态
    const updateTempMessageStatus = (messageId, status) => {
        const messageIndex = messages.value.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
            messages.value[messageIndex] = {
                ...messages.value[messageIndex],
                status
            };
        }
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
        clearMessageData,
        addTempMessage,
        updateTempMessageStatus
    };
});
