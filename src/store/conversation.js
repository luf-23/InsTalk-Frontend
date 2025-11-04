import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useUserInfoStore } from "@/store/userInfo";
import { friendshipStore } from "@/store/friendship";
import { groupStore } from "@/store/group";
import { messageStore } from "@/store/message";
import { markMessageAsReadService, markMessageListAsReadService } from "@/api/message";
import { ElMessage } from "element-plus";

/**
 * 会话列表 Store
 * 
 * 功能说明：
 * 1. 会话只用于快速开启对话，不存储消息内容
 * 2. 类似 QQ 的会话机制：不是有消息就有会话
 * 3. 删除会话不会删除聊天记录
 * 4. 会话在以下情况创建：
 *    - 主动发起对话（点击好友/群组发送消息）
 *    - 接收到新消息
 * 5. 会话包含：
 *    - 会话 ID（好友 ID 或群组 ID）
 *    - 会话类型（friend/group）
 *    - 会话名称（从好友/群组 store 获取）
 *    - 最后消息内容（用于预览）
 *    - 最后消息时间
 *    - 未读消息数
 *    - 置顶状态
 */
export const conversationStore = defineStore('conversation', () => {
    // 会话列表
    const conversations = ref([]);
    
    // 获取当前用户 ID
    const getCurrentUserId = () => {
        const userInfoStore = useUserInfoStore();
        return userInfoStore.userId;
    };

    /**
     * 创建或更新会话
     * @param {Object} params - 会话参数
     * @param {Number} params.id - 会话 ID（好友 ID 或群组 ID）
     * @param {String} params.type - 会话类型 'friend' | 'group'
     * @param {Object} params.lastMessage - 最后一条消息对象（可选）
     * @param {Boolean} params.isNewMessage - 是否是新消息触发（用于增加未读数）
     */
    const createOrUpdateConversation = (params) => {
        const { id, type, lastMessage = null, isNewMessage = false } = params;
        
        // 如果是群组会话，检查群组是否存在（用户是否还在群组中）
        if (type === 'group') {
            const gStore = groupStore();
            const groupExists = gStore.allGroups.some(g => g.id === id);
            if (!groupExists) {
                console.log(`无法创建或更新会话，群组不存在或已退出，群组 ID: ${id}`);
                return;
            }
        }
        
        // 如果是好友会话，检查好友是否存在
        if (type === 'friend') {
            const friendStore = friendshipStore();
            const friendExists = friendStore.friends.some(f => f.id === id);
            if (!friendExists) {
                console.log(`无法创建或更新会话，好友不存在或已删除，好友 ID: ${id}`);
                return;
            }
        }
        
        // 查找现有会话
        const existingIndex = conversations.value.findIndex(
            conv => conv.id === id && conv.type === type
        );

        const currentUserId = getCurrentUserId();
        const isOwnMessage = lastMessage && lastMessage.senderId === currentUserId;

        if (existingIndex !== -1) {
            // 更新现有会话
            const conversation = conversations.value[existingIndex];
            
            // 更新最后消息信息
            if (lastMessage) {
                conversation.lastMessage = lastMessage;
                conversation.lastMessageTime = lastMessage.sentAt;
            }
            
            // 如果是新收到的消息（不是自己发的），增加未读数
            if (isNewMessage && !isOwnMessage) {
                conversation.unreadCount = (conversation.unreadCount || 0) + 1;
            }
            
            // 更新时间戳
            conversation.updatedAt = new Date().toISOString();
            
            // 移动到列表顶部（如果不是置顶的话，在排序时会自动处理）
        } else {
            // 创建新会话
            const newConversation = {
                id,
                type,
                lastMessage,
                lastMessageTime: lastMessage ? lastMessage.sentAt : new Date().toISOString(),
                unreadCount: (isNewMessage && !isOwnMessage) ? 1 : 0,
                isPinned: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            conversations.value.push(newConversation);
        }
    };

    /**
     * 删除会话
     * @param {Number} id - 会话 ID
     * @param {String} type - 会话类型
     * @param {Boolean} silent - 是否静默删除（不显示提示）
     */
    const deleteConversation = (id, type, silent = false) => {
        const index = conversations.value.findIndex(
            conv => conv.id === id && conv.type === type
        );
        
        if (index !== -1) {
            conversations.value.splice(index, 1);
            
            if (!silent) {
                ElMessage.success('会话已删除');
            }
            
            console.log(`已删除会话 - ID: ${id}, 类型: ${type}`);
        }
    };

    /**
     * 清空未读消息数
     * @param {Number} id - 会话 ID
     * @param {String} type - 会话类型
     * @param {Boolean} skipApiCall - 是否跳过 API 调用(避免重复调用)
     */
    const clearUnreadCount = async (id, type, skipApiCall = false) => {
        const conversation = conversations.value.find(
            conv => conv.id === id && conv.type === type
        );
        
        if (conversation && conversation.unreadCount > 0) {
            // 先清空未读数，避免重复调用
            const unreadCount = conversation.unreadCount;
            conversation.unreadCount = 0;
            
            // 如果跳过 API 调用，直接返回
            if (skipApiCall) {
                return;
            }
            
            // 获取该会话的所有未读消息 ID
            const msgStore = messageStore();
            const currentUserId = getCurrentUserId();
            
            const unreadMessages = msgStore.messages.filter(msg => {
                if (type === 'friend') {
                    // 好友会话：对方发来的未读消息
                    return msg.senderId === id && 
                           msg.receiverId === currentUserId && 
                           !msg.isRead;
                } else {
                    // 群组会话：群里其他人发的未读消息
                    return msg.groupId === id && 
                           msg.senderId !== currentUserId && 
                           !msg.isRead;
                }
            });

            // 如果有未读消息，调用 API 标记为已读
            if (unreadMessages.length > 0) {
                try {
                    const messageIds = unreadMessages.map(msg => msg.id);
                    
                    console.log(`标记 ${messageIds.length} 条消息为已读，会话 ID: ${id}, 类型: ${type}`);
                    
                    if (messageIds.length === 1) {
                        // 单条消息
                        await markMessageAsReadService({ messageId: messageIds[0] });
                    } else {
                        // 多条消息
                        await markMessageListAsReadService({ messageIds: messageIds.join(',') });
                    }
                    
                    // 更新本地消息的已读状态
                    unreadMessages.forEach(msg => {
                        msg.isRead = true;
                    });
                    
                    console.log(`成功标记 ${messageIds.length} 条消息为已读`);
                } catch (error) {
                    console.error('标记消息已读失败:', error);
                    // API 调用失败，恢复未读数
                    conversation.unreadCount = unreadCount;
                }
            }
        }
    };

    /**
     * 置顶/取消置顶会话
     * @param {Number} id - 会话 ID
     * @param {String} type - 会话类型
     */
    const togglePinConversation = (id, type) => {
        const conversation = conversations.value.find(
            conv => conv.id === id && conv.type === type
        );
        
        if (conversation) {
            conversation.isPinned = !conversation.isPinned;
            ElMessage.success(conversation.isPinned ? '已置顶' : '已取消置顶');
        }
    };

    /**
     * 从消息同步会话列表
     * 用于初始化或从消息列表重建会话
     * @param {Boolean} force - 是否强制同步（忽略已有的持久化数据）
     */
    const syncConversationsFromMessages = (force = false) => {
        // 如果已有持久化的会话数据，且不是强制同步，则跳过
        if (!force && conversations.value.length > 0) {
            console.log('已有持久化的会话数据，跳过同步');
            return;
        }
        
        const msgStore = messageStore();
        const friendStore = friendshipStore();
        const gStore = groupStore();
        const currentUserId = getCurrentUserId();
        
        // 创建会话映射
        const conversationMap = new Map();
        
        // 遍历所有消息，构建会话
        msgStore.messages.forEach(message => {
            let convKey, convId, convType;
            
            if (message.groupId) {
                // 群组消息
                convKey = `group_${message.groupId}`;
                convId = message.groupId;
                convType = 'group';
                
                // 检查该群组是否还存在（用户是否还在群组中）
                const groupExists = gStore.allGroups.some(g => g.id === message.groupId);
                if (!groupExists) {
                    // 群组不存在（已退出），跳过该消息
                    console.log(`跳过已退出群组的消息，群组 ID: ${message.groupId}`);
                    return;
                }
            } else {
                // 好友消息：找到对方的 ID
                const otherId = message.senderId === currentUserId 
                    ? message.receiverId 
                    : message.senderId;
                convKey = `friend_${otherId}`;
                convId = otherId;
                convType = 'friend';
                
                // 检查该好友是否还存在（已删除的好友消息会被自动清理，这里作为额外保护）
                const friendExists = friendStore.friends.some(f => f.id === otherId);
                if (!friendExists) {
                    // 好友不存在（已删除），跳过该消息
                    console.log(`跳过已删除好友的消息，好友 ID: ${otherId}`);
                    return;
                }
            }
            
            // 获取或创建会话信息
            let convInfo = conversationMap.get(convKey);
            if (!convInfo) {
                // 检查是否已存在会话
                const existingConv = conversations.value.find(
                    c => c.id === convId && c.type === convType
                );
                
                convInfo = existingConv || {
                    id: convId,
                    type: convType,
                    lastMessage: null,
                    lastMessageTime: null,
                    unreadCount: 0,
                    isPinned: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }
            
            // 更新最后消息（按时间）
            const messageTime = new Date(message.sentAt).getTime();
            const currentLastTime = convInfo.lastMessageTime 
                ? new Date(convInfo.lastMessageTime).getTime() 
                : 0;
            
            if (messageTime >= currentLastTime) {
                convInfo.lastMessage = message;
                convInfo.lastMessageTime = message.sentAt;
            }
            
            // 统计未读消息
            if (!message.isRead && message.senderId !== currentUserId) {
                convInfo.unreadCount = (convInfo.unreadCount || 0) + 1;
            }
            
            conversationMap.set(convKey, convInfo);
        });
        
        // 合并到会话列表
        conversationMap.forEach((convInfo, key) => {
            const existingIndex = conversations.value.findIndex(
                c => c.id === convInfo.id && c.type === convInfo.type
            );
            
            if (existingIndex !== -1) {
                // 保留置顶状态，更新其他信息
                const isPinned = conversations.value[existingIndex].isPinned;
                conversations.value[existingIndex] = {
                    ...convInfo,
                    isPinned
                };
            } else {
                conversations.value.push(convInfo);
            }
        });
    };

    /**
     * 获取会话显示名称
     * @param {Object} conversation - 会话对象
     * @returns {String} 显示名称
     */
    const getConversationName = (conversation) => {
        if (!conversation) return '';
        
        const friendStore = friendshipStore();
        const gStore = groupStore();
        
        if (conversation.type === 'friend') {
            const friend = friendStore.friends.find(f => f.id === conversation.id);
            return friend?.username || `用户 ${conversation.id}`;
        } else {
            const group = gStore.allGroups.find(g => g.id === conversation.id);
            return group?.name || `群组 ${conversation.id}`;
        }
    };

    /**
     * 获取会话头像
     * @param {Object} conversation - 会话对象
     * @returns {String} 头像 URL
     */
    const getConversationAvatar = (conversation) => {
        if (!conversation) return '';
        
        const friendStore = friendshipStore();
        const gStore = groupStore();
        
        if (conversation.type === 'friend') {
            const friend = friendStore.friends.find(f => f.id === conversation.id);
            return friend?.avatar || '';
        } else {
            const group = gStore.allGroups.find(g => g.id === conversation.id);
            return group?.avatar || '';
        }
    };

    /**
     * 获取排序后的会话列表
     * 排序规则：
     * 1. 置顶的在前
     * 2. 按最后消息时间降序
     */
    const sortedConversations = computed(() => {
        return [...conversations.value].sort((a, b) => {
            // 置顶优先
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            
            // 按最后消息时间降序
            const timeA = new Date(a.lastMessageTime || a.updatedAt).getTime();
            const timeB = new Date(b.lastMessageTime || b.updatedAt).getTime();
            return timeB - timeA;
        });
    });

    /**
     * 获取总未读消息数
     */
    const totalUnreadCount = computed(() => {
        return conversations.value.reduce((total, conv) => {
            return total + (conv.unreadCount || 0);
        }, 0);
    });

    /**
     * 清空所有数据（用于退出登录时）
     */
    const clearConversationData = () => {
        conversations.value = [];
    };

    /**
     * 清理无效的会话（已退出的群组、已删除的好友）
     * 用于定期清理或在需要时手动调用
     */
    const cleanupInvalidConversations = () => {
        const friendStore = friendshipStore();
        const gStore = groupStore();
        
        let removedCount = 0;
        
        // 过滤出有效的会话
        conversations.value = conversations.value.filter(conv => {
            if (conv.type === 'group') {
                // 检查群组是否存在
                const groupExists = gStore.allGroups.some(g => g.id === conv.id);
                if (!groupExists) {
                    console.log(`清理已退出群组的会话，群组 ID: ${conv.id}`);
                    removedCount++;
                    return false;
                }
            } else if (conv.type === 'friend') {
                // 检查好友是否存在
                const friendExists = friendStore.friends.some(f => f.id === conv.id);
                if (!friendExists) {
                    console.log(`清理已删除好友的会话，好友 ID: ${conv.id}`);
                    removedCount++;
                    return false;
                }
            }
            return true;
        });
        
        if (removedCount > 0) {
            console.log(`清理了 ${removedCount} 个无效会话`);
        }
        
        return removedCount;
    };

    return {
        conversations,
        sortedConversations,
        totalUnreadCount,
        createOrUpdateConversation,
        deleteConversation,
        clearUnreadCount,
        togglePinConversation,
        syncConversationsFromMessages,
        getConversationName,
        getConversationAvatar,
        clearConversationData,
        cleanupInvalidConversations
    };
}, {
    persist: {
        key: 'instalk-conversations',
        storage: localStorage,
        paths: ['conversations']
    }
});
