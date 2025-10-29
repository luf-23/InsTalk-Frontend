import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { sendMessageService, getMessageHistoryService } from "@/api/message";
import { useUserInfoStore } from "@/store/userInfo";
import { conversationStore } from "@/store/conversation";
import { ElMessage } from "element-plus";
import websocketService from "@/util/websocket";
import { useAuthStore } from "@/store/auth";

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
    // WebSocket 连接状态
    const wsConnected = ref(false);
    // WebSocket 消息处理器
    let wsMessageHandler = null;
    let wsOnlineStatusHandler = null;

    // 获取消息历史（强制从服务器刷新）
    const fetchMessageHistory = async (force = false) => {
        // 如果本地已有消息且不是强制刷新，则跳过
        if (!force && messages.value.length > 0) {
            console.log('本地已有消息，跳过获取历史消息');
            return;
        }
        
        loading.value.messages = true;
        try {
            const data = await getMessageHistoryService();
            messages.value = data || [];
            console.log('从服务器获取消息历史成功');
        } catch (error) {
            console.error('获取消息历史失败:', error);
            ElMessage.error('获取消息历史失败');
        } finally {
            loading.value.messages = false;
        }
    };
    
    // 初始化消息数据（智能加载）
    const initMessages = async () => {
        // 如果本地已有消息，直接使用本地数据
        if (messages.value.length > 0) {
            console.log(`使用本地缓存的 ${messages.value.length} 条消息`);
        } else {
            // 本地无数据，从服务器获取
            console.log('本地无消息，从服务器获取历史消息');
            await fetchMessageHistory(true);
        }
        
        // 初始化 WebSocket 连接
        initWebSocket();
    };

    /**
     * 初始化 WebSocket 连接
     */
    const initWebSocket = () => {
        const authStore = useAuthStore();
        const token = authStore.accessToken;
        
        if (!token) {
            console.error('无法初始化 WebSocket：缺少访问令牌');
            return;
        }

        // 注册消息处理器
        wsMessageHandler = (messageVO) => {
            console.log('收到新消息通过 WebSocket:', messageVO);
            
            // 检查消息是否已存在
            const exists = messages.value.some(m => m.id === messageVO.id);
            if (!exists) {
                messages.value.push(messageVO);
                
                // 创建或更新会话
                const convStore = conversationStore();
                const currentUserId = getCurrentUserId();
                
                let conversationId, conversationType;
                
                if (messageVO.groupId) {
                    // 群组消息
                    conversationId = messageVO.groupId;
                    conversationType = 'group';
                } else {
                    // 好友消息：找到对方的 ID
                    conversationId = messageVO.senderId === currentUserId 
                        ? messageVO.receiverId 
                        : messageVO.senderId;
                    conversationType = 'friend';
                }
                
                // 创建或更新会话（新收到的消息）
                convStore.createOrUpdateConversation({
                    id: conversationId,
                    type: conversationType,
                    lastMessage: messageVO,
                    isNewMessage: true
                });
                
                // 显示通知（如果不在当前聊天窗口）
                if (!currentChat.value || 
                    currentChat.value.id !== conversationId || 
                    chatType.value !== conversationType) {
                    ElMessage.info({
                        message: `收到新消息`,
                        duration: 2000
                    });
                }
            }
        };

        wsOnlineStatusHandler = (statusData) => {
            console.log('用户在线状态更新:', statusData);
            // 可以在这里更新好友列表的在线状态
            // 这里暂时只记录日志，具体实现可以在 friendship store 中处理
        };

        // 注册处理器
        websocketService.on('newMessage', wsMessageHandler);
        websocketService.on('onlineStatus', wsOnlineStatusHandler);
        websocketService.on('open', () => {
            wsConnected.value = true;
            console.log('WebSocket 已连接');
        });
        websocketService.on('close', () => {
            wsConnected.value = false;
            console.log('WebSocket 已断开');
        });

        // 连接 WebSocket
        websocketService.connect(token);
    };

    /**
     * 断开 WebSocket 连接
     */
    const disconnectWebSocket = () => {
        // 移除处理器
        if (wsMessageHandler) {
            websocketService.off('newMessage', wsMessageHandler);
            wsMessageHandler = null;
        }
        if (wsOnlineStatusHandler) {
            websocketService.off('onlineStatus', wsOnlineStatusHandler);
            wsOnlineStatusHandler = null;
        }

        // 断开连接
        websocketService.disconnect();
        wsConnected.value = false;
    };

    // 发送消息
    const sendMessage = async (messageData) => {
        loading.value.send = true;
        try {
            // API 返回 MessageVO
            const messageVO = await sendMessageService(messageData);
            if (messageVO) {
                // 检查消息是否已存在(避免与 WebSocket 重复)
                const exists = messages.value.some(m => m.id === messageVO.id);
                if (!exists) {
                    // 直接将返回的消息插入到消息列表中
                    messages.value.push(messageVO);
                    
                    // 创建或更新会话（自己发送的消息，不增加未读数）
                    const convStore = conversationStore();
                    const conversationId = messageVO.groupId || messageVO.receiverId;
                    const conversationType = messageVO.groupId ? 'group' : 'friend';
                    
                    convStore.createOrUpdateConversation({
                        id: conversationId,
                        type: conversationType,
                        lastMessage: messageVO,
                        isNewMessage: false // 自己发送的消息
                    });
                }
                
                // 返回包含成功状态和消息对象的结果
                return { success: true, message: messageVO };
            }
            return { success: false, message: null };
        } catch (error) {
            console.error('发送消息失败:', error);
            ElMessage.error('发送消息失败');
            return { success: false, message: null, error };
        } finally {
            loading.value.send = false;
        }
    };

    // 获取最新的一条消息（用于显示）
    const getLastMessage = () => {
        if (messages.value.length === 0) return null;
        
        // 找到时间戳最大的消息
        const sortedMessages = [...messages.value].sort((a, b) => 
            getTimeForComparison(b.sentAt) - getTimeForComparison(a.sentAt)
        );
        return sortedMessages[0];
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
        }).sort((a, b) => getTimeForComparison(a.sentAt) - getTimeForComparison(b.sentAt));
    });

    // 获取聊天列表（最近的对话）
    const getChatList = computed(() => {
            const chatMap = new Map();
            // 先按时间升序排序，保证后面覆盖的是最新的
            const sortedMessages = [...messages.value].sort((a, b) => getTimeForComparison(a.sentAt) - getTimeForComparison(b.sentAt));
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
                    lastMessageTime: message.sentAt
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
        // 断开 WebSocket
        disconnectWebSocket();
        
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
        wsConnected,
        initMessages,
        fetchMessageHistory,
        sendMessage,
        setCurrentChat,
        getCurrentChatMessages,
        getChatList,
        clearMessageData,
        initWebSocket,
        disconnectWebSocket
    };
}, {
    persist: {
        key: 'instalk-messages',
        storage: localStorage,
        paths: ['messages', 'currentChat', 'chatType']
    }
});
