<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { useAuthStore } from '../store/auth.js'
import { useUserInfoStore } from '../store/userInfo.js'
import { friendshipStore } from '../store/friendship.js'
import { groupStore } from '../store/group.js'
import { messageStore } from '../store/message.js'
import { 
  Search, 
  MoreFilled, 
  Refresh, 
  ChatDotRound, 
  Plus, 
  ArrowLeft,
  Picture,
  Document,
  Promotion
} from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()
const userInfoStore = useUserInfoStore()
const friendStore = friendshipStore()
const groupData = groupStore()
const msgStore = messageStore()

// 主界面状态
const mainView = ref('chat') // 'chat' | 'friends' | 'groups'
const activeTab = ref('friends')

// 聊天相关状态
const currentInputMessage = ref('')
const messageListRef = ref(null)

// 搜索相关
const searchUsername = ref('')
const showSearchResults = ref(false)

// 创建群组相关
const createGroupDialog = ref(false)
const groupForm = ref({
  name: '',
  description: ''
})
const groupFormRules = {
  name: [
    { required: true, message: '请输入群组名称', trigger: 'blur' },
    { min: 2, max: 30, message: '长度应在 2 到 30 个字符之间', trigger: 'blur' }
  ],
  description: [
    { max: 200, message: '描述不能超过 200 个字符', trigger: 'blur' }
  ]
}
const groupFormRef = ref(null)

// 初始化数据
onMounted(async () => {
  // 加载好友列表
  await friendStore.fetchFriendList()
  
  // 加载好友申请
  await friendStore.fetchPendingRequests()
  
  // 加载我的群组
  await groupData.fetchMyGroups()
  
  // 加载所有群组（用于发现功能）
  await groupData.fetchAllGroups()
  
  // 加载消息历史
  await msgStore.fetchMessageHistory()
})

// 监听当前聊天变化，滚动到底部
watch(() => msgStore.getCurrentChatMessages.value, () => {
  nextTick(() => {
    scrollToBottom()
  })
}, { deep: true })

// 处理退出登录
const handleLogout = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要退出登录吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    // 清除 Pinia store 中的所有信息
    authStore.clearAuth()
    userInfoStore.clearUserInfo()
    friendStore.clearFriendshipData()
    groupData.clearGroupData()
    msgStore.clearMessageData()
    
    ElMessage.success('已成功退出登录')
    
    // 跳转到登录页
    router.push('/login')
  } catch {
    // 用户取消退出
  }
}

// 界面切换
const switchToChat = () => {
  mainView.value = 'chat'
}

const switchToFriends = () => {
  mainView.value = 'friends'
  activeTab.value = 'friends'
}

const switchToGroups = () => {
  mainView.value = 'groups'
  activeTab.value = 'groups'
}

// 好友功能相关
const handleSearch = async () => {
  await friendStore.searchUsers(searchUsername.value)
  showSearchResults.value = true
}

const handleSendRequest = async (userId) => {
  await friendStore.sendFriendRequest(userId)
}

const handleAcceptRequest = async (requestId) => {
  await friendStore.acceptFriendRequest(requestId)
}

const handleRejectRequest = async (requestId) => {
  await friendStore.rejectFriendRequest(requestId)
}

const handleDeleteFriend = async (friendId) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除该好友吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await friendStore.deleteFriend(friendId)
  } catch {
    // 用户取消操作
  }
}

const closeSearch = () => {
  showSearchResults.value = false
  searchUsername.value = ''
  friendStore.clearSearchResults()
}

// 群组功能相关
const handleCreateGroupSubmit = async () => {
  try {
    await groupFormRef.value.validate()
    const loading = ElLoading.service({
      lock: true,
      text: '创建群组中...',
      background: 'rgba(0, 0, 0, 0.7)',
    })
    
    const result = await groupData.createGroup(groupForm.value)
    loading.close()
    
    if (result) {
      createGroupDialog.value = false
      groupForm.value = { name: '', description: '' }
    }
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

const handleJoinGroup = async (groupId) => {
  try {
    await groupData.joinGroup(groupId)
  } catch (error) {
    console.error('加入群组失败:', error)
  }
}

const refreshGroups = async () => {
  try {
    await groupData.fetchAllGroups()
    const available = availableGroups.value.length
    const total = groupData.allGroups.length
    
    // 详细调试信息
    console.group('🔍 群组刷新完成')
    console.log('📊 统计信息:', {
      total,
      available,
      joined: groupData.myGroups.length,
      currentUserId: userInfoStore.userInfo?.id
    })
    console.log('📋 所有群组:', groupData.allGroups.map(g => ({
      id: g.id,
      name: g.name,
      members: g.members?.length || 0,
      isMember: isAlreadyGroupMember(g.id)
    })))
    console.log('👥 我的群组:', groupData.myGroups.map(g => ({
      id: g.id,
      name: g.name,
      members: g.members?.length || 0
    })))
    console.groupEnd()
    
    if (available > 0) {
      ElMessage.success(`发现 ${available} 个可加入的群组，共 ${total} 个群组`)
    } else if (total > 0) {
      ElMessage.info(`已加载 ${total} 个群组，您已加入所有可见群组`)
    } else {
      ElMessage.info('暂无可用群组，请联系管理员创建群组')
    }
  } catch (error) {
    console.error('刷新群组列表失败:', error)
    ElMessage.error('刷新群组列表失败')
  }
}

// 聊天功能相关
const startChatWithFriend = (friend) => {
  msgStore.setCurrentChat(friend, 'friend')
  mainView.value = 'chat'
}

const startChatWithGroup = (group) => {
  msgStore.setCurrentChat(group, 'group')
  mainView.value = 'chat'
}

const sendMessage = async () => {
  if (!currentInputMessage.value.trim() || !msgStore.currentChat) return
  
  const messageData = {
    content: currentInputMessage.value.trim(),
    messageType: 'TEXT'
  }
  
  if (msgStore.chatType === 'friend') {
    messageData.receiverId = msgStore.currentChat.id
  } else if (msgStore.chatType === 'group') {
    messageData.groupId = msgStore.currentChat.id
  }
  
  const success = await msgStore.sendMessage(messageData)
  if (success) {
    currentInputMessage.value = ''
  }
}

const scrollToBottom = () => {
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

const formatMessageTime = (time) => {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else {
    return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
}

const isMyMessage = (message) => {
  return message.senderId === userInfoStore.userInfo?.id
}

// 显示好友或群组成员数量
const memberCount = (members) => {
  return members?.length || 0
}

// 判断是否已经是群组成员
const isAlreadyGroupMember = (groupId) => {
  return groupData.isGroupMember(groupId)
}

// 计算可加入的群组（排除已经加入的群组）
const availableGroups = computed(() => {
  const available = groupData.allGroups.filter(group => !isAlreadyGroupMember(group.id))
  console.log('计算可加入群组:', {
    allGroups: groupData.allGroups.length,
    myGroups: groupData.myGroups.length,
    available: available.length,
    currentUserId: userInfoStore.userInfo?.id
  })
  return available
})

// 计算群组统计信息
const groupStats = computed(() => {
  return {
    total: groupData.allGroups.length,
    joined: groupData.myGroups.length,
    available: availableGroups.value.length
  }
})

// 获取好友昵称或用户名
const getFriendName = (friendId) => {
  const friend = friendStore.friends.find(f => f.id === friendId)
  return friend ? (friend.nickname || friend.username) : `用户${friendId}`
}

// 获取群组名称
const getGroupName = (groupId) => {
  const group = groupData.myGroups.find(g => g.id === groupId) || 
                groupData.allGroups.find(g => g.id === groupId)
  return group ? group.name : `群组${groupId}`
}

// 计算用户详情
const userInfo = computed(() => {
  return userInfoStore.userInfo || {}
})

// 计算聊天标题
const chatTitle = computed(() => {
  if (!msgStore.currentChat) return ''
  
  if (msgStore.chatType === 'friend') {
    return getFriendName(msgStore.currentChat.id)
  } else if (msgStore.chatType === 'group') {
    return getGroupName(msgStore.currentChat.id)
  }
  return ''
})

// 计算聊天列表（包含好友和群组的最近消息）
const chatList = computed(() => {
  const chats = []
  
  // 添加有消息的好友
  friendStore.friends.forEach(friend => {
    const messages = msgStore.messages.filter(msg => 
      (msg.senderId === friend.id || msg.receiverId === friend.id) && !msg.groupId
    )
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      chats.push({
        ...friend,
        type: 'friend',
        lastMessage,
        lastMessageTime: lastMessage.sendAt
      })
    } else {
      // 没有消息的好友也显示
      chats.push({
        ...friend,
        type: 'friend',
        lastMessage: null,
        lastMessageTime: null
      })
    }
  })
  
  // 添加有消息的群组
  groupData.myGroups.forEach(group => {
    const messages = msgStore.messages.filter(msg => msg.groupId === group.id)
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      chats.push({
        ...group,
        type: 'group',
        lastMessage,
        lastMessageTime: lastMessage.sendAt
      })
    } else {
      // 没有消息的群组也显示
      chats.push({
        ...group,
        type: 'group',
        lastMessage: null,
        lastMessageTime: null
      })
    }
  })
  
  // 按最后消息时间排序
  return chats.sort((a, b) => {
    if (!a.lastMessageTime && !b.lastMessageTime) return 0
    if (!a.lastMessageTime) return 1
    if (!b.lastMessageTime) return -1
    return new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
  })
})
</script>

<template>
  <div class="home-container">
    <!-- 顶部导航栏 -->
    <div class="header">
      <div class="header-content">
        <h1>InsTalk</h1>
        
        <!-- 导航按钮 -->
        <div class="nav-buttons">
          <el-button 
            :type="mainView === 'chat' ? 'primary' : ''"
            @click="switchToChat"
            :icon="ChatDotRound"
          >
            聊天
          </el-button>
          <el-button 
            :type="mainView === 'friends' ? 'primary' : ''"
            @click="switchToFriends"
          >
            好友
          </el-button>
          <el-button 
            :type="mainView === 'groups' ? 'primary' : ''"
            @click="switchToGroups"
          >
            群组
          </el-button>
        </div>
        
        <div class="user-menu">
          <span class="username">{{ userInfo.nickname || userInfo.username || '欢迎回来！' }}</span>
          <el-button type="primary" @click="handleLogout">退出登录</el-button>
        </div>
      </div>
    </div>
    
    <div class="main-content">
      <!-- 聊天界面 -->
      <div v-if="mainView === 'chat'" class="chat-container">
        <!-- 聊天列表 -->
        <div class="chat-sidebar">
          <div class="chat-list-header">
            <h3>最近聊天</h3>
          </div>
          
          <div class="chat-list">
            <div v-if="chatList.length === 0" class="empty-list">
              <el-empty description="暂无聊天记录" :image-size="80">
                <el-button type="primary" @click="switchToFriends">添加好友开始聊天</el-button>
              </el-empty>
            </div>
            
            <div v-else>
              <div 
                v-for="chat in chatList" 
                :key="`${chat.type}_${chat.id}`" 
                class="chat-list-item"
                :class="{ active: msgStore.currentChat?.id === chat.id && msgStore.chatType === chat.type }"
                @click="chat.type === 'friend' ? startChatWithFriend(chat) : startChatWithGroup(chat)"
              >
                <el-avatar :size="50" :src="chat.avatar">
                  {{ (chat.nickname || chat.name || chat.username).charAt(0).toUpperCase() }}
                </el-avatar>
                <div class="chat-item-info">
                  <div class="chat-name">
                    {{ chat.type === 'friend' ? (chat.nickname || chat.username) : chat.name }}
                    <el-tag v-if="chat.type === 'group'" size="small" type="info">群</el-tag>
                  </div>
                  <div class="last-message" v-if="chat.lastMessage">
                    {{ chat.lastMessage.content }}
                  </div>
                  <div class="last-message empty" v-else>
                    点击开始聊天
                  </div>
                </div>
                <div class="chat-time" v-if="chat.lastMessageTime">
                  {{ formatMessageTime(chat.lastMessageTime) }}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 聊天窗口 -->
        <div class="chat-window">
          <!-- 聊天头部 -->
          <div v-if="msgStore.currentChat" class="chat-header">
            <div class="chat-info">
              <el-avatar :size="40" :src="msgStore.currentChat.avatar">
                {{ (msgStore.currentChat.nickname || msgStore.currentChat.name || msgStore.currentChat.username).charAt(0).toUpperCase() }}
              </el-avatar>
              <div class="chat-title-info">
                <div class="chat-title">{{ chatTitle }}</div>
                <div class="chat-subtitle">
                  {{ msgStore.chatType === 'group' ? `群聊 · ${memberCount(msgStore.currentChat.members)}人` : '私聊' }}
                </div>
              </div>
            </div>
          </div>
          
          <!-- 消息列表 -->
          <div class="message-container" ref="messageListRef">
            <div v-if="!msgStore.currentChat" class="no-chat-selected">
              <el-empty description="选择一个聊天开始对话">
                <el-button type="primary" @click="switchToFriends">
                  <el-icon><Plus /></el-icon>
                  开始新的聊天
                </el-button>
              </el-empty>
            </div>
            
            <div v-else-if="msgStore.loading.messages" class="message-loading">
              <el-skeleton animated :rows="5" />
            </div>
            
            <div v-else class="message-list">
              <div v-if="msgStore.getCurrentChatMessages.length === 0" class="empty-messages">
                <el-empty description="还没有消息，发送第一条消息吧！" :image-size="80" />
              </div>
              
              <div v-else>
                <div 
                  v-for="message in msgStore.getCurrentChatMessages" 
                  :key="message.id" 
                  class="message-item"
                  :class="{ 'my-message': isMyMessage(message), 'other-message': !isMyMessage(message) }"
                >
                  <el-avatar 
                    v-if="!isMyMessage(message)" 
                    :size="36" 
                    class="message-avatar"
                  >
                    {{ getFriendName(message.senderId).charAt(0).toUpperCase() }}
                  </el-avatar>
                  
                  <div class="message-content">
                    <div v-if="!isMyMessage(message) && msgStore.chatType === 'group'" class="message-sender">
                      {{ getFriendName(message.senderId) }}
                    </div>
                    <div class="message-bubble">
                      <div class="message-text">{{ message.content }}</div>
                      <div class="message-time">{{ formatMessageTime(message.sendAt) }}</div>
                    </div>
                  </div>
                  
                  <el-avatar 
                    v-if="isMyMessage(message)" 
                    :size="36" 
                    class="message-avatar"
                    :src="userInfo.avatar"
                  >
                    {{ (userInfo.nickname || userInfo.username).charAt(0).toUpperCase() }}
                  </el-avatar>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 消息输入区 -->
          <div v-if="msgStore.currentChat" class="message-input-area">
            <div class="input-toolbar">
              <!-- 工具栏可以添加表情、图片、文件等功能 -->
            </div>
            <div class="input-container">
              <el-input
                v-model="currentInputMessage"
                type="textarea"
                :rows="3"
                placeholder="输入消息..."
                @keydown.enter.exact="sendMessage"
                @keydown.enter.shift.exact.prevent
                resize="none"
              />
              <el-button 
                type="primary" 
                @click="sendMessage"
                :loading="msgStore.loading.send"
                :disabled="!currentInputMessage.trim()"
                class="send-button"
              >
                <el-icon><Promotion /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 好友管理界面 -->
      <div v-if="mainView === 'friends'" class="friends-container">
        <div class="page-header">
          <h2>好友管理</h2>
          <el-button @click="switchToChat" :icon="ArrowLeft">返回聊天</el-button>
        </div>
        
        <div class="friends-content">
          <!-- 搜索栏 -->
          <div class="search-section">
            <h3>添加好友</h3>
            <div class="search-bar">
              <el-input
                v-model="searchUsername"
                placeholder="搜索用户名"
                @keyup.enter="handleSearch"
                size="large"
              >
                <template #append>
                  <el-button @click="handleSearch" :loading="friendStore.loading.search">
                    <el-icon><Search /></el-icon>
                  </el-button>
                </template>
              </el-input>
            </div>
          </div>
          
          <!-- 好友申请 -->
          <div class="requests-section">
            <div class="section-title">
              <h3>好友申请</h3>
              <el-badge :value="friendStore.pendingRequests.length" :hidden="!friendStore.pendingRequests.length" type="danger" />
            </div>
            
            <el-skeleton :loading="friendStore.loading.pending" animated :count="3" v-if="friendStore.loading.pending">
              <template #template>
                <div class="friend-request-item skeleton-item">
                  <el-skeleton-item variant="circle" style="width: 50px; height: 50px;" />
                  <div style="flex: 1; margin-left: 16px;">
                    <el-skeleton-item variant="text" style="width: 60%;" />
                    <el-skeleton-item variant="text" style="width: 40%;" />
                  </div>
                </div>
              </template>
            </el-skeleton>
            
            <div v-else-if="friendStore.pendingRequests.length === 0" class="empty-section">
              <el-empty description="暂无好友申请" :image-size="60" />
            </div>
            
            <div v-else class="request-list">
              <div v-for="request in friendStore.pendingRequests" :key="request.id" class="friend-request-item">
                <el-avatar :size="50" :src="request.avatar">
                  {{ request.username.charAt(0).toUpperCase() }}
                </el-avatar>
                <div class="request-info">
                  <div class="request-name">{{ request.nickname || request.username }}</div>
                  <div class="request-username">@{{ request.username }}</div>
                </div>
                <div class="request-actions">
                  <el-button size="small" type="primary" @click="handleAcceptRequest(request.id)">
                    接受
                  </el-button>
                  <el-button size="small" @click="handleRejectRequest(request.id)">
                    拒绝
                  </el-button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 好友列表 -->
          <div class="friends-section">
            <div class="section-title">
              <h3>我的好友</h3>
              <el-tag size="small">{{ friendStore.friends.length }}人</el-tag>
            </div>
            
            <el-skeleton :loading="friendStore.loading.friends" animated :count="5" v-if="friendStore.loading.friends">
              <template #template>
                <div class="friend-item skeleton-item">
                  <el-skeleton-item variant="circle" style="width: 50px; height: 50px;" />
                  <el-skeleton-item variant="text" style="width: 60%; margin-left: 16px;" />
                </div>
              </template>
            </el-skeleton>
            
            <div v-else-if="friendStore.friends.length === 0" class="empty-section">
              <el-empty description="暂无好友，快去添加吧" :image-size="60">
                <el-button type="primary" @click="searchUsername = ''; handleSearch()">搜索用户</el-button>
              </el-empty>
            </div>
            
            <div v-else class="friend-list">
              <div v-for="friend in friendStore.friends" :key="friend.id" class="friend-item">
                <el-avatar :size="50" :src="friend.avatar">
                  {{ friend.username.charAt(0).toUpperCase() }}
                </el-avatar>
                <div class="friend-info">
                  <div class="friend-name">{{ friend.nickname || friend.username }}</div>
                  <div class="friend-username">@{{ friend.username }}</div>
                </div>
                <div class="friend-actions">
                  <el-button size="small" type="primary" @click="startChatWithFriend(friend)">
                    聊天
                  </el-button>
                  <el-dropdown trigger="click">
                    <el-button size="small">
                      <el-icon><MoreFilled /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="handleDeleteFriend(friend.id)">
                          删除好友
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 群组管理界面 -->
      <div v-if="mainView === 'groups'" class="groups-container">
        <div class="page-header">
          <h2>群组管理</h2>
          <div class="header-actions">
            <el-button type="primary" @click="createGroupDialog = true">
              <el-icon><Plus /></el-icon>
              创建群组
            </el-button>
            <el-button @click="refreshGroups" :loading="groupData.loading.allGroups">
              <el-icon><Refresh /></el-icon>
              发现群组
            </el-button>
            <el-button @click="switchToChat" :icon="ArrowLeft">返回聊天</el-button>
          </div>
        </div>
        
        <div class="groups-content">
          <!-- 我的群组 -->
          <div class="my-groups-section">
            <div class="section-title">
              <h3>我的群组</h3>
              <el-tag size="small">{{ groupData.myGroups.length }}个</el-tag>
            </div>
            
            <el-skeleton :loading="groupData.loading.myGroups" animated :count="3" v-if="groupData.loading.myGroups">
              <template #template>
                <div class="group-item skeleton-item">
                  <el-skeleton-item variant="circle" style="width: 50px; height: 50px;" />
                  <div style="flex: 1; margin-left: 16px;">
                    <el-skeleton-item variant="text" style="width: 70%;" />
                    <el-skeleton-item variant="text" style="width: 50%;" />
                  </div>
                </div>
              </template>
            </el-skeleton>
            
            <div v-else-if="groupData.myGroups.length === 0" class="empty-section">
              <el-empty description="暂无群组，创建或加入一个吧" :image-size="60">
                <el-button type="primary" @click="createGroupDialog = true">创建群组</el-button>
              </el-empty>
            </div>
            
            <div v-else class="group-list">
              <div v-for="group in groupData.myGroups" :key="group.id" class="group-item">
                <el-avatar :size="50">{{ group.name.charAt(0).toUpperCase() }}</el-avatar>
                <div class="group-info">
                  <div class="group-name">{{ group.name }}</div>
                  <div class="group-meta">
                    <el-tag size="small">{{ memberCount(group.members) }}人</el-tag>
                    <span class="group-description" v-if="group.description">{{ group.description }}</span>
                  </div>
                </div>
                <div class="group-actions">
                  <el-button size="small" type="primary" @click="startChatWithGroup(group)">
                    聊天
                  </el-button>
                </div>
              </div>
            </div>
          </div>
          
              <!-- 发现群组 -->
              <div class="discover-groups-section">
                <div class="section-title">
                  <h3>发现群组</h3>
                  <div class="group-stats">
                    <el-tag size="small" type="info" v-if="groupStats.total > 0">
                      总共{{ groupStats.total }}个
                    </el-tag>
                    <el-tag size="small" type="success" v-if="groupStats.available > 0">
                      可加入{{ groupStats.available }}个
                    </el-tag>
                  </div>
                </div>            <el-skeleton :loading="groupData.loading.allGroups" animated :count="3" v-if="groupData.loading.allGroups">
              <template #template>
                <div class="group-item skeleton-item">
                  <el-skeleton-item variant="circle" style="width: 50px; height: 50px;" />
                  <div style="flex: 1; margin-left: 16px;">
                    <el-skeleton-item variant="text" style="width: 70%;" />
                    <el-skeleton-item variant="text" style="width: 50%;" />
                  </div>
                </div>
              </template>
            </el-skeleton>
            
            <div v-else-if="!groupData.allGroups.length" class="empty-section">
              <el-empty description="点击上方'发现群组'按钮查找群组" :image-size="60">
                <el-button type="primary" @click="refreshGroups" :loading="groupData.loading.allGroups">发现群组</el-button>
              </el-empty>
            </div>
            
            <!-- 显示所有群组，区分已加入和可加入 -->
            <div v-else class="group-list">
              <!-- 群组状态提示 -->
              <div v-if="groupData.allGroups.length > 0" class="groups-status-header">
                <div v-if="availableGroups.length > 0" style="margin-bottom: 16px;">
                  <el-alert
                    :title="`找到 ${availableGroups.length} 个可加入的群组`"
                    type="success"
                    :closable="false"
                    show-icon
                  />
                </div>
                
                <div v-if="groupData.myGroups.length > 0 && availableGroups.length === 0" style="margin-bottom: 16px;">
                  <el-alert
                    title="您已加入所有可见的群组"
                    type="info"
                    :closable="false"
                    show-icon
                  />
                </div>
                
                <!-- 图例 -->
                <div class="group-legend" style="margin-bottom: 16px;">
                  <el-tag size="small" type="success">绿框 = 可加入</el-tag>
                  <el-tag size="small" type="info">灰框 = 已加入</el-tag>
                </div>
              </div>
              
              <div v-for="group in groupData.allGroups" :key="group.id" class="group-item" :class="{ 'joined-group': isAlreadyGroupMember(group.id), 'available-group': !isAlreadyGroupMember(group.id) }">
                <el-avatar :size="50">{{ group.name.charAt(0).toUpperCase() }}</el-avatar>
                <div class="group-info">
                  <div class="group-name">{{ group.name }}</div>
                  <div class="group-meta">
                    <el-tag size="small">{{ memberCount(group.members) }}人</el-tag>
                    <div class="group-description" v-if="group.description">{{ group.description }}</div>
                  </div>
                </div>
                <div class="group-actions">
                  <!-- 已加入的群组显示聊天按钮 -->
                  <el-button 
                    v-if="isAlreadyGroupMember(group.id)"
                    size="small" 
                    type="success" 
                    @click="startChatWithGroup(group)"
                  >
                    开始聊天
                  </el-button>
                  
                  <!-- 未加入的群组显示加入按钮 -->
                  <el-button 
                    v-else
                    size="small" 
                    type="primary" 
                    @click="handleJoinGroup(group.id)"
                    :loading="groupData.loading.join"
                  >
                    加入群组
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  
  <!-- 用户搜索结果对话框 -->
  <el-dialog
    v-model="showSearchResults"
    title="用户搜索结果"
    width="500px"
    @close="closeSearch"
  >
    <el-skeleton :loading="friendStore.loading.search" animated :count="3" v-if="friendStore.loading.search">
      <template #template>
        <div class="search-result-item skeleton-item">
          <el-skeleton-item variant="circle" style="width: 40px; height: 40px;" />
          <el-skeleton-item variant="text" style="width: 70%; margin-left: 16px;" />
        </div>
      </template>
    </el-skeleton>
    
    <div v-else-if="friendStore.searchResults.length === 0" class="empty-list">
      未找到匹配的用户
    </div>
    
    <div v-else class="search-results">
      <div v-for="user in friendStore.searchResults" :key="user.id" class="search-result-item">
        <el-avatar :size="40" :src="user.avatar">
          {{ user.username.charAt(0).toUpperCase() }}
        </el-avatar>
        <div class="user-info">
          <div class="user-name">{{ user.nickname || user.username }}</div>
          <div class="user-username">@{{ user.username }}</div>
        </div>
        <div class="user-actions">
          <el-button size="small" type="primary" @click="handleSendRequest(user.id)">
            添加好友
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
  
  <!-- 创建群组对话框 -->
  <el-dialog
    v-model="createGroupDialog"
    title="创建新群组"
    width="500px"
  >
    <el-form 
      ref="groupFormRef"
      :model="groupForm"
      :rules="groupFormRules"
      label-width="100px"
    >
      <el-form-item label="群组名称" prop="name">
        <el-input v-model="groupForm.name" maxlength="30" show-word-limit />
      </el-form-item>
      
      <el-form-item label="群组描述" prop="description">
        <el-input 
          v-model="groupForm.description" 
          type="textarea" 
          maxlength="200" 
          show-word-limit
          :rows="4"
        />
      </el-form-item>
    </el-form>
    
    <template #footer>
      <el-button @click="createGroupDialog = false">取消</el-button>
      <el-button type="primary" @click="handleCreateGroupSubmit" :loading="groupData.loading.create">
        创建
      </el-button>
    </template>
  </el-dialog>
</div>
</template>


<style scoped>
.home-container {
  min-height: 100vh;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
}

/* 顶部导航栏 */
.header {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 0 20px;
  z-index: 100;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  max-width: 1400px;
  margin: 0 auto;
}

.header h1 {
  color: #409eff;
  font-size: 24px;
  font-weight: 700;
}

.nav-buttons {
  display: flex;
  gap: 8px;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 16px;
}

.username {
  color: #666;
  font-size: 14px;
}

/* 主内容区 */
.main-content {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

/* 聊天界面 */
.chat-container {
  display: flex;
  width: 100%;
  height: calc(100vh - 100px);
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

/* 聊天侧边栏 */
.chat-sidebar {
  width: 300px;
  border-right: 1px solid #eaeaea;
  display: flex;
  flex-direction: column;
  background-color: #f8f9fa;
}

.chat-list-header {
  padding: 16px 20px;
  border-bottom: 1px solid #eaeaea;
}

.chat-list-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
}

.chat-list-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f0f0f0;
}

.chat-list-item:hover {
  background-color: #f5f7fa;
}

.chat-list-item.active {
  background-color: #ecf5ff;
  border-right: 3px solid #409eff;
}

.chat-item-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
}

.chat-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  margin-bottom: 4px;
}

.last-message {
  color: #909399;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.last-message.empty {
  font-style: italic;
}

.chat-time {
  color: #c0c4cc;
  font-size: 11px;
  white-space: nowrap;
}

/* 聊天窗口 */
.chat-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #fff;
}

.chat-header {
  padding: 16px 20px;
  border-bottom: 1px solid #eaeaea;
  background-color: white;
}

.chat-info {
  display: flex;
  align-items: center;
}

.chat-title-info {
  margin-left: 12px;
}

.chat-title {
  font-weight: 600;
  font-size: 16px;
  color: #303133;
}

.chat-subtitle {
  color: #909399;
  font-size: 12px;
  margin-top: 2px;
}

/* 消息区域 */
.message-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background-color: #f8f9fa;
}

.no-chat-selected {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-loading {
  padding: 20px;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-messages {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.message-item {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 80%;
}

.message-item.my-message {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-item.other-message {
  align-self: flex-start;
}

.message-avatar {
  flex-shrink: 0;
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-sender {
  font-size: 12px;
  color: #909399;
  padding: 0 12px;
}

.message-bubble {
  max-width: 100%;
  padding: 12px 16px;
  border-radius: 18px;
  position: relative;
}

.my-message .message-bubble {
  background-color: #409eff;
  color: white;
}

.other-message .message-bubble {
  background-color: white;
  color: #303133;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.message-text {
  word-break: break-word;
  line-height: 1.4;
}

.message-time {
  font-size: 11px;
  opacity: 0.7;
  margin-top: 4px;
}

/* 消息输入区 */
.message-input-area {
  border-top: 1px solid #eaeaea;
  background-color: white;
}

.input-toolbar {
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
  min-height: 20px;
}

.input-container {
  padding: 16px;
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.input-container :deep(.el-textarea) {
  flex: 1;
}

.send-button {
  height: 40px;
  padding: 0 16px;
}

/* 好友管理界面 */
.friends-container,
.groups-container {
  width: 100%;
  height: calc(100vh - 100px);
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #eaeaea;
  background-color: white;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.friends-content,
.groups-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* 搜索区域 */
.search-section {
  margin-bottom: 32px;
}

.search-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.search-bar {
  max-width: 400px;
}

/* 区块样式 */
.requests-section,
.friends-section,
.my-groups-section,
.discover-groups-section {
  margin-bottom: 32px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #f0f0f0;
}

.section-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.empty-section {
  text-align: center;
  padding: 40px 20px;
}

/* 列表项样式 */
.request-list,
.friend-list,
.group-list {
  display: grid;
  gap: 12px;
}

.friend-request-item,
.friend-item,
.group-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-radius: 8px;
  background-color: #fafafa;
  border: 1px solid #f0f0f0;
  transition: all 0.2s;
  cursor: pointer;
}

.friend-request-item:hover,
.friend-item:hover,
.group-item:hover {
  background-color: #f5f7fa;
  border-color: #dcdfe6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.request-info,
.friend-info,
.group-info {
  flex: 1;
  margin-left: 16px;
  min-width: 0;
}

.request-name,
.friend-name,
.group-name {
  font-weight: 500;
  margin-bottom: 4px;
  color: #303133;
}

.request-username,
.friend-username {
  color: #909399;
  font-size: 12px;
}

.group-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #909399;
}

.group-description {
  color: #606266;
  font-size: 12px;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request-actions,
.friend-actions,
.group-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 骨架屏样式 */
.skeleton-item {
  padding: 16px 20px;
  border-radius: 8px;
  background-color: #fafafa;
  margin-bottom: 12px;
}

/* 群组状态样式 */
.available-group {
  border-left: 4px solid #67c23a;
}

.joined-group {
  border-left: 4px solid #909399;
  opacity: 0.8;
}

.groups-status-header {
  margin-bottom: 16px;
}

.group-legend {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
}

.group-stats {
  display: flex;
  gap: 8px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-content {
    padding: 0 16px;
  }
  
  .nav-buttons {
    display: none;
  }
  
  .main-content {
    padding: 10px;
  }
  
  .chat-container {
    height: calc(100vh - 80px);
  }
  
  .chat-sidebar {
    width: 280px;
  }
  
  .page-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .header-actions {
    align-self: stretch;
    justify-content: flex-end;
  }
}
</style>