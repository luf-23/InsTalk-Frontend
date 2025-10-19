import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { sendMessageService, getMessageHistoryService, getNewMessagesService } from "@/api/message";
import { useUserInfoStore } from "@/store/userInfo";
import { conversationStore } from "@/store/conversation";
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
    // 轮询定时器
    let pollingTimer = null;
    // 轮询间隔（毫秒）
    const pollingInterval = ref(2000); // 默认2秒轮询一次
    // 是否启用轮询（用于调试）
    const pollingEnabled = ref(true); // 设为 false 可关闭轮询

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
            // 启动轮询获取新消息
            startPolling();
            return;
        }
        
        // 本地无数据，从服务器获取
        console.log('本地无消息，从服务器获取历史消息');
        await fetchMessageHistory(true);
        // 启动轮询
        startPolling();
    };

    // 发送消息
    const sendMessage = async (messageData) => {
        loading.value.send = true;
        try {
            // API 返回 MessageVO
            const messageVO = await sendMessageService(messageData);
            if (messageVO) {
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
                
                return true;
            }
            return false;
        } catch (error) {
            console.error('发送消息失败:', error);
            ElMessage.error('发送消息失败');
            return false;
        } finally {
            loading.value.send = false;
        }
    };

    // 获取最新的一条消息（用于轮询时传递给后端）
    const getLastMessage = () => {
        if (messages.value.length === 0) return null;
        
        // 找到时间戳最大的消息
        const sortedMessages = [...messages.value].sort((a, b) => 
            getTimeForComparison(b.sentAt) - getTimeForComparison(a.sentAt)
        );
        return sortedMessages[0];
    };

    // 获取新消息
    const fetchNewMessages = async () => {
        try {
            const lastMessage = getLastMessage();
            // 如果没有上一条消息，避免向后端发送 null，传 undefined 让 service 使用默认的空对象 {}
            const newMessages = await getNewMessagesService(lastMessage ?? undefined);
            
            if (newMessages && newMessages.length > 0) {
                // 过滤掉已存在的消息（根据消息ID）
                const existingIds = new Set(messages.value.map(m => m.id));
                const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
                
                // 将新消息添加到消息列表
                messages.value.push(...uniqueNewMessages);
                
                // 为每条新消息创建或更新会话
                const convStore = conversationStore();
                const currentUserId = getCurrentUserId();
                
                uniqueNewMessages.forEach(message => {
                    // 判断会话 ID 和类型
                    let conversationId, conversationType;
                    
                    if (message.groupId) {
                        // 群组消息
                        conversationId = message.groupId;
                        conversationType = 'group';
                    } else {
                        // 好友消息：找到对方的 ID
                        conversationId = message.senderId === currentUserId 
                            ? message.receiverId 
                            : message.senderId;
                        conversationType = 'friend';
                    }
                    
                    // 创建或更新会话（新收到的消息）
                    convStore.createOrUpdateConversation({
                        id: conversationId,
                        type: conversationType,
                        lastMessage: message,
                        isNewMessage: true // 新收到的消息，会增加未读数
                    });
                });
                
                // 如果有新消息且不在当前聊天窗口，可以显示提示
                if (uniqueNewMessages.length > 0) {
                    console.log(`收到 ${uniqueNewMessages.length} 条新消息`);
                }
                
                return uniqueNewMessages;
            }
            return [];
        } catch (error) {
            console.error('获取新消息失败:', error);
            // 轮询失败不显示错误提示，避免打扰用户
            return [];
        }
    };

    // 启动轮询
    const startPolling = () => {
        // 检查是否启用轮询
        if (!pollingEnabled.value) {
            console.log('轮询已禁用，跳过启动');
            return;
        }
        
        // 如果已经有定时器在运行，先清除
        if (pollingTimer) {
            stopPolling();
        }
        
        console.log('开始轮询新消息...');
        
        // 立即执行一次
        fetchNewMessages();
        
        // 设置定时器
        pollingTimer = setInterval(() => {
            fetchNewMessages();
        }, pollingInterval.value);
    };

    // 停止轮询
    const stopPolling = () => {
        if (pollingTimer) {
            console.log('停止轮询新消息');
            clearInterval(pollingTimer);
            pollingTimer = null;
        }
    };

    // 设置轮询间隔
    const setPollingInterval = (interval) => {
        if (interval < 1000) {
            console.warn('轮询间隔不能小于1秒');
            return;
        }
        pollingInterval.value = interval;
        
        // 如果正在轮询，重启轮询以应用新的间隔
        if (pollingTimer) {
            startPolling();
        }
    };

    // 启用/禁用轮询
    const setPollingEnabled = (enabled) => {
        pollingEnabled.value = enabled;
        
        if (enabled) {
            console.log('轮询已启用');
            startPolling();
        } else {
            console.log('轮询已禁用');
            stopPolling();
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
        // 停止轮询
        stopPolling();
        
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
        pollingInterval,
        pollingEnabled,
        initMessages,
        fetchMessageHistory,
        sendMessage,
        setCurrentChat,
        getCurrentChatMessages,
        getChatList,
        clearMessageData,
        fetchNewMessages,
        startPolling,
        stopPolling,
        setPollingInterval,
        setPollingEnabled
    };
}, {
    persist: {
        key: 'instalk-messages',
        storage: localStorage,
        paths: ['messages', 'currentChat', 'chatType']
    }
});
