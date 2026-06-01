import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { sendMessageService, getMessageHistoryService, getNewMessagesService, revokeMessageService, deleteMessageService, forwardMessageService } from "@/api/message";
import { useUserInfoStore } from "@/store/userInfo";
import { conversationStore } from "@/store/conversation";
import { friendshipStore } from "@/store/friendship";
import { groupStore } from "@/store/group";
import { ElMessage } from "element-plus";
import websocketService from "@/util/websocket";
import { useAuthStore } from "@/store/auth";
import * as messageDb from "@/util/messageDb";

// 时间比较辅助函数
const getTimeForComparison = (timeString) => {
  if (!timeString) return 0;
  
  // 处理标准日期时间格式
  const date = new Date(timeString);
  return isNaN(date.getTime()) ? 0 : date.getTime();
};

export const messageStore = defineStore('message', () => {
    // 运行时消息缓存（持久化在 IndexedDB）
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
    let wsMessageRecallHandler = null;
    let wsOnlineStatusHandler = null;
    let wsFriendDeletedHandler = null;
    let wsGroupDeletedHandler = null;
    
    // 用户信息缓存 - 用于保存已经退群的用户信息
    // key: userId, value: { username, avatar }
    const userInfoCache = ref({});

    const getCurrentUserId = () => {
        const userInfoStore = useUserInfoStore();
        return userInfoStore.userInfo?.id || null;
    };

    const fetchMessageHistory = async (force = false) => {
        if (!force && messages.value.length > 0) {
            console.log('本地已有消息，跳过获取历史消息');
            return;
        }

        loading.value.messages = true;
        try {
            const data = await getMessageHistoryService();
            const list = data || [];
            messages.value = list;
            await messageDb.replaceAllMessages(list, getCurrentUserId());
            console.log('从服务器获取消息历史成功');
        } catch (error) {
            console.error('获取消息历史失败:', error);
            ElMessage.error('获取消息历史失败');
        } finally {
            loading.value.messages = false;
        }
    };

    const loadMessagesFromDb = async () => {
        await messageDb.initMessageDb();
        messages.value = await messageDb.getAllMessages();
    };

    const mergeIncomingMessages = async (newMessages, isNewMessage = true) => {
        if (!newMessages || !Array.isArray(newMessages) || newMessages.length === 0) {
            return 0;
        }

        const existingIds = new Set(messages.value.map(m => m.id));
        const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
        if (uniqueNewMessages.length === 0) {
            return 0;
        }

        messages.value.push(...uniqueNewMessages);
        await messageDb.putMessages(uniqueNewMessages, getCurrentUserId());

        const convStore = conversationStore();
        const currentUserId = getCurrentUserId();

        uniqueNewMessages.forEach(messageVO => {
            let conversationId;
            let conversationType;

            if (messageVO.groupId) {
                conversationId = messageVO.groupId;
                conversationType = 'group';
            } else {
                conversationId = messageVO.senderId === currentUserId
                    ? messageVO.receiverId
                    : messageVO.senderId;
                conversationType = 'friend';
            }

            convStore.createOrUpdateConversation({
                id: conversationId,
                type: conversationType,
                lastMessage: messageVO,
                isNewMessage
            });
        });

        return uniqueNewMessages.length;
    };

    const resolveLastMessage = async () => {
        const fromDb = await messageDb.getLastMessage();
        if (fromDb) {
            return fromDb;
        }
        return getLastMessage();
    };

    const syncNewMessages = async () => {
        const lastMessage = await resolveLastMessage();
        if (!lastMessage) {
            if (messages.value.length === 0) {
                await fetchMessageHistory(true);
            }
            return 0;
        }

        try {
            const newMessages = await getNewMessagesService({
                id: lastMessage.id,
                senderId: lastMessage.senderId,
                receiverId: lastMessage.receiverId,
                groupId: lastMessage.groupId,
                content: lastMessage.content,
                messageType: lastMessage.messageType,
                sentAt: lastMessage.sentAt,
                isRead: lastMessage.isRead
            });
            return await mergeIncomingMessages(newMessages, true);
        } catch (error) {
            console.error('同步新消息失败:', error);
            return 0;
        }
    };

    const initMessages = async () => {
        await messageDb.initMessageDb();
        await messageDb.migrateMessagesFromLocalStorage(getCurrentUserId());
        await loadMessagesFromDb();

        if (messages.value.length > 0) {
            console.log(`从 IndexedDB 加载 ${messages.value.length} 条消息`);
            const added = await syncNewMessages();
            if (added > 0) {
                console.log(`初始化时同步 ${added} 条新消息`);
            }
        } else {
            console.log('IndexedDB 无消息，从服务器获取历史消息');
            await fetchMessageHistory(true);
        }

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
        wsMessageHandler = async (messageVO) => {
            console.log('收到新消息通过 WebSocket:', messageVO);

            const exists = messages.value.some(m => m.id === messageVO.id);
            if (exists) {
                return;
            }

            const added = await mergeIncomingMessages([messageVO], true);
            if (added === 0) {
                return;
            }

            const currentUserId = getCurrentUserId();
            let conversationId;
            let conversationType;

            if (messageVO.groupId) {
                conversationId = messageVO.groupId;
                conversationType = 'group';
            } else {
                conversationId = messageVO.senderId === currentUserId
                    ? messageVO.receiverId
                    : messageVO.senderId;
                conversationType = 'friend';
            }

            if (!currentChat.value ||
                currentChat.value.id !== conversationId ||
                chatType.value !== conversationType) {
                ElMessage.info({
                    message: `收到新消息`,
                    duration: 2000
                });
            }
        };

        // 注册消息撤回处理器
        wsMessageRecallHandler = async (data) => {
            console.log('收到消息撤回通知:', data);
            const messageId = data.messageId;

            const messageIndex = messages.value.findIndex(m => m.id === messageId);
            if (messageIndex !== -1) {
                const message = messages.value[messageIndex];
                messages.value.splice(messageIndex, 1);
                await messageDb.deleteMessage(messageId);
                updateConversationAfterMessageDeletion(message);
                console.log(`消息 ${messageId} 已从列表中移除（撤回）`);
            }
        };

        wsOnlineStatusHandler = (statusData) => {
            console.log('用户在线状态更新:', statusData);
            // 可以在这里更新好友列表的在线状态
            // 这里暂时只记录日志，具体实现可以在 friendship store 中处理
        };

        // 注册好友删除处理器
        wsFriendDeletedHandler = (data) => {
            console.log('收到好友删除通知:', data);
            const friendId = data.friendId || data.userId;
            
            if (friendId) {
                // 从好友列表中移除该用户
                const friendStore = friendshipStore();
                const friendIndex = friendStore.friends.findIndex(f => f.id === friendId);
                if (friendIndex !== -1) {
                    friendStore.friends.splice(friendIndex, 1);
                    console.log(`用户 ${friendId} 已将你从好友列表中删除`);
                }
                
                // 删除与该用户的会话
                const convStore = conversationStore();
                convStore.deleteConversation(friendId, 'friend', true);
                
                // 如果正在与该用户聊天，清空当前聊天
                if (currentChat.value && 
                    currentChat.value.id === friendId && 
                    chatType.value === 'friend') {
                    setCurrentChat(null, 'friend');
                }
                
                // 提示用户
                ElMessage.warning('你已被对方从好友列表中移除');
            }
        };

        // 注册群组解散处理器
        wsGroupDeletedHandler = (data) => {
            console.log('收到群组解散通知:', data);
            const groupId = data.groupId;
            
            if (groupId) {
                // 从群组列表中移除该群组
                const gStore = groupStore();
                const groupIndex = gStore.allGroups.findIndex(g => g.id === groupId);
                if (groupIndex !== -1) {
                    gStore.allGroups.splice(groupIndex, 1);
                    console.log(`群组 ${groupId} 已被解散`);
                }
                
                // 如果是自己创建的群组，也从 myGroups 中移除
                const myGroupIndex = gStore.myGroups.findIndex(g => g.id === groupId);
                if (myGroupIndex !== -1) {
                    gStore.myGroups.splice(myGroupIndex, 1);
                }
                
                // 删除与该群组的会话
                const convStore = conversationStore();
                convStore.deleteConversation(groupId, 'group', true);
                
                // 如果正在与该群组聊天，清空当前聊天
                if (currentChat.value && 
                    currentChat.value.id === groupId && 
                    chatType.value === 'group') {
                    setCurrentChat(null, 'group');
                }
                
                // 提示用户
                ElMessage.warning('该群组已被解散');
            }
        };

        // 注册处理器
        websocketService.on('newMessage', wsMessageHandler);
        websocketService.on('messageRecall', wsMessageRecallHandler);
        websocketService.on('onlineStatus', wsOnlineStatusHandler);
        websocketService.on('friendDeleted', wsFriendDeletedHandler);
        websocketService.on('groupDeleted', wsGroupDeletedHandler);
        websocketService.on('open', async (data) => {
            wsConnected.value = true;
            console.log('WebSocket 已连接');
            if (data?.reconnected) {
                const added = await syncNewMessages();
                if (added > 0) {
                    console.log(`WebSocket 重连后同步 ${added} 条新消息`);
                }
            }
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
        if (wsMessageRecallHandler) {
            websocketService.off('messageRecall', wsMessageRecallHandler);
            wsMessageRecallHandler = null;
        }
        if (wsOnlineStatusHandler) {
            websocketService.off('onlineStatus', wsOnlineStatusHandler);
            wsOnlineStatusHandler = null;
        }
        if (wsFriendDeletedHandler) {
            websocketService.off('friendDeleted', wsFriendDeletedHandler);
            wsFriendDeletedHandler = null;
        }
        if (wsGroupDeletedHandler) {
            websocketService.off('groupDeleted', wsGroupDeletedHandler);
            wsGroupDeletedHandler = null;
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
                    messages.value.push(messageVO);
                    await messageDb.putMessage(messageVO, getCurrentUserId());

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

    const persistMessage = async (message) => {
        if (!message?.id) {
            return;
        }
        const index = messages.value.findIndex(m => m.id === message.id);
        if (index !== -1) {
            messages.value[index] = { ...message };
        }
        await messageDb.putMessage(message, getCurrentUserId());
    };

    const deleteMessagesByIds = async (messageIds) => {
        if (!messageIds?.length) {
            return;
        }
        const idSet = new Set(messageIds);
        messages.value = messages.value.filter(m => !idSet.has(m.id));
        await messageDb.deleteMessages(messageIds);
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

    // 清空所有数据（用于退出登录时）
    const clearMessageData = async () => {
        disconnectWebSocket();

        await messageDb.clearAllMessages();
        messages.value = [];
        currentChat.value = null;
        chatType.value = 'friend';
        loading.value = {
            messages: false,
            send: false
        };
        // 清空用户信息缓存
        userInfoCache.value = {};
    };

    // 删除消息（本地删除）
    const deleteMessage = async (messageId) => {
        try {
            // 先找到要删除的消息
            const messageToDelete = messages.value.find(m => m.id === messageId);
            if (!messageToDelete) {
                return { success: false, error: '消息不存在' };
            }
            
            // 调用本地删除服务
            await deleteMessageService(messageId);
            
            // 从本地消息列表中移除
            const index = messages.value.findIndex(m => m.id === messageId);
            if (index !== -1) {
                messages.value.splice(index, 1);
            }
            await messageDb.deleteMessage(messageId);

            updateConversationAfterMessageDeletion(messageToDelete);
            
            return { success: true };
        } catch (error) {
            console.error('删除消息失败:', error);
            return { success: false, error };
        }
    };

    // 撤回消息（调用后端API）
    const recallMessage = async (messageId) => {
        try {
            // 先找到要撤回的消息
            const messageToRecall = messages.value.find(m => m.id === messageId);
            if (!messageToRecall) {
                return { success: false, error: '消息不存在' };
            }
            
            // 调用后端撤回API
            await revokeMessageService({ messageId });
            
            // API 调用成功，从本地消息列表中移除
            const index = messages.value.findIndex(m => m.id === messageId);
            if (index !== -1) {
                messages.value.splice(index, 1);
            }
            await messageDb.deleteMessage(messageId);

            updateConversationAfterMessageDeletion(messageToRecall);
            
            return { success: true };
        } catch (error) {
            console.error('撤回消息失败:', error);
            return { success: false, error };
        }
    };

    /**
     * 在消息删除后更新会话的最后一条消息
     * @param {Object} deletedMessage - 被删除的消息对象
     */
    const updateConversationAfterMessageDeletion = (deletedMessage) => {
        const convStore = conversationStore();
        const currentUserId = getCurrentUserId();
        
        // 确定会话 ID 和类型
        let conversationId, conversationType;
        if (deletedMessage.groupId) {
            conversationId = deletedMessage.groupId;
            conversationType = 'group';
        } else {
            conversationId = deletedMessage.senderId === currentUserId 
                ? deletedMessage.receiverId 
                : deletedMessage.senderId;
            conversationType = 'friend';
        }
        
        // 查找该会话
        const conversation = convStore.conversations.find(
            conv => conv.id === conversationId && conv.type === conversationType
        );
        
        // 如果会话不存在或被删除的消息不是会话的最后一条消息，直接返回
        if (!conversation || conversation.lastMessage?.id !== deletedMessage.id) {
            return;
        }
        
        // 找到该会话中剩余的最新消息
        const conversationMessages = messages.value.filter(msg => {
            if (conversationType === 'group') {
                return msg.groupId === conversationId;
            } else {
                return (msg.senderId === conversationId || msg.receiverId === conversationId) && !msg.groupId;
            }
        });
        
        if (conversationMessages.length > 0) {
            // 按时间排序，找到最新的消息
            const sortedMessages = [...conversationMessages].sort((a, b) => 
                getTimeForComparison(b.sentAt) - getTimeForComparison(a.sentAt)
            );
            const newLastMessage = sortedMessages[0];
            
            // 更新会话的最后一条消息
            conversation.lastMessage = newLastMessage;
            conversation.lastMessageTime = newLastMessage.sentAt;
            conversation.updatedAt = new Date().toISOString();
        } else {
            // 没有剩余消息，清空最后一条消息
            conversation.lastMessage = null;
            conversation.lastMessageTime = null;
            conversation.updatedAt = new Date().toISOString();
        }
    };

    /**
     * AI 流式结束后拉取服务器上新消息（WebSocket 可能因网关/多实例未推到当前页）
     * @param {Object} anchorMessage - 本轮用户消息的 MessageVO，作为 /newMessageList 游标
     */
    const pullMessagesAfterAiReply = async (anchorMessage) => {
        if (!anchorMessage || anchorMessage.id == null) return;

        const maxAttempts = 12;
        const delayMs = 200;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (attempt > 0) {
                await new Promise((r) => setTimeout(r, delayMs));
            }
            try {
                const newMessages = await getNewMessagesService(anchorMessage);
                const added = await mergeIncomingMessages(newMessages, true);
                if (added > 0) {
                    return;
                }
            } catch (error) {
                console.error('AI 回复后同步消息失败:', error);
            }
        }
    };

    // 转发消息
    const forwardMessage = async (originalMessage, targetId, targetType) => {
        loading.value.send = true;
        try {
            // 构建转发消息数据
            const messageData = {
                content: originalMessage.content,
                messageType: originalMessage.messageType
            };
            
            if (targetType === 'friend') {
                messageData.receiverId = targetId;
            } else if (targetType === 'group') {
                messageData.groupId = targetId;
            }
            
            // 使用发送消息接口来转发
            const messageVO = await sendMessageService(messageData);
            
            if (messageVO) {
                // 检查消息是否已存在
                const exists = messages.value.some(m => m.id === messageVO.id);
                if (!exists) {
                    messages.value.push(messageVO);
                    await messageDb.putMessage(messageVO, getCurrentUserId());

                    const convStore = conversationStore();
                    convStore.createOrUpdateConversation({
                        id: targetId,
                        type: targetType,
                        lastMessage: messageVO,
                        isNewMessage: false
                    });
                }
                
                return { success: true, message: messageVO };
            }
            
            return { success: false };
        } catch (error) {
            console.error('转发消息失败:', error);
            return { success: false, error };
        } finally {
            loading.value.send = false;
        }
    };

    return {
        messages,
        currentChat,
        chatType,
        loading,
        wsConnected,
        userInfoCache,
        initMessages,
        fetchMessageHistory,
        sendMessage,
        setCurrentChat,
        getCurrentChatMessages,
        getChatList,
        clearMessageData,
        initWebSocket,
        disconnectWebSocket,
        deleteMessage,
        recallMessage,
        forwardMessage,
        pullMessagesAfterAiReply,
        persistMessage,
        deleteMessagesByIds,
        syncNewMessages
    };
}, {
    persist: {
        key: 'instalk-messages',
        storage: localStorage,
        paths: ['currentChat', 'chatType', 'userInfoCache']
    }
});
