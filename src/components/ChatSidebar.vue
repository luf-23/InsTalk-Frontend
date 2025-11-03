<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessageBox, ElMessage } from 'element-plus';
import { 
  ChatDotRound, UserFilled, Collection, 
  Setting, SwitchButton, Search, Plus, 
  MoreFilled, Delete, Position, Star, Check, More, ArrowDown, ArrowRight,
  User, InfoFilled, RemoveFilled, Upload, StarFilled
} from '@element-plus/icons-vue';
import UserProfileDialog from './UserProfileDialog.vue';
import FriendInfoDialog from './FriendInfoDialog.vue';
import GroupInfoDialog from './GroupInfoDialog.vue';
import ContextMenu from './ContextMenu.vue';
import { friendshipStore } from '@/store/friendship';
import { groupStore } from '@/store/group';
import { messageStore } from '@/store/message';
import { conversationStore } from '@/store/conversation';
import { onlineStatusStore } from '@/store/onlineStatus';
import { useAuthStore } from '@/store/auth';
import { useUserInfoStore } from '@/store/userInfo';
import { searchGroupByNameService } from '@/api/group';
import { logoutService } from '@/api/auth';
import { ossClient } from '@/util/oss';

// 路由和Store初始化
const router = useRouter();
const friendStore = friendshipStore();
const gStore = groupStore();
const msgStore = messageStore();
const convStore = conversationStore();
const onlineStore = onlineStatusStore();
const authStore = useAuthStore();
const userInfoStore = useUserInfoStore();

// 用户信息
const username = computed(() => userInfoStore.username);
const userAvatar = computed(() => userInfoStore.avatar);
const userRole = computed(() => userInfoStore.role);
const userInitials = computed(() => getInitials(username.value));

// 选项卡激活状态
const activeTab = ref('chats');

// 搜索查询
const searchQuery = ref('');

// 聊天相关数据 - 使用会话列表
const chatList = computed(() => {
  return convStore.sortedConversations.map(conv => {
    // 获取 role 信息（如果是好友对话）
    let role = null;
    if (conv.type === 'friend') {
      const friend = friends.value.find(f => f.id === conv.id);
      role = friend?.role;
    }
    
    return {
      id: conv.id,
      type: conv.type,
      name: convStore.getConversationName(conv),
      avatar: convStore.getConversationAvatar(conv),
      lastMessage: conv.lastMessage,
      lastMessageTime: conv.lastMessageTime,
      unreadCount: conv.unreadCount,
      isPinned: conv.isPinned,
      role: role
    };
  });
});

// 好友相关数据
const friends = computed(() => friendStore.friends);
const pendingRequests = computed(() => friendStore.pendingRequests);
const pendingRequestsCount = computed(() => pendingRequests.value.length);
const searchResults = computed(() => friendStore.searchResults);
const loading = computed(() => ({
  ...friendStore.loading,
  ...gStore.loading,
  searchGroup: false
}));

// 创建在线状态的缓存映射，避免频繁调用 isUserOnline
const friendOnlineStatus = computed(() => {
  const statusMap = new Map();
  friends.value.forEach(friend => {
    statusMap.set(friend.id, onlineStore.isUserOnline(friend.id));
  });
  return statusMap;
});

// 检查好友是否在线（使用缓存）
const isFriendOnline = (friendId) => {
  return friendOnlineStatus.value.get(friendId) || false;
};

// 群组相关数据
const allGroups = computed(() => gStore.allGroups);
const groupSearchResults = ref([]);
const groupSearchQuery = ref('');

// 群组分类和展开状态
const showCreatedGroups = ref(false);
const showManagedGroups = ref(false);
const showJoinedGroups = ref(false);

const createdGroups = computed(() => gStore.allGroups.filter(g => g.ownerId === userInfoStore.userId));
const managedGroups = computed(() => gStore.allGroups.filter(g => Array.isArray(g.adminIds) && g.adminIds.includes(userInfoStore.userId) && g.ownerId !== userInfoStore.userId));
const joinedGroups = computed(() =>
  gStore.allGroups.filter(g =>
    Array.isArray(g.members) &&
    g.members.some(m => m.id === userInfoStore.userId) &&
    g.ownerId !== userInfoStore.userId &&
    !(Array.isArray(g.adminIds) && g.adminIds.includes(userInfoStore.userId))
  )
);

// 对话框显示状态
const addFriendDialogVisible = ref(false);
const pendingRequestsDialogVisible = ref(false);
const createGroupDialogVisible = ref(false);
const joinGroupDialogVisible = ref(false);
const userProfileDialogVisible = ref(false);
const friendInfoDialogVisible = ref(false);
const groupInfoDialogVisible = ref(false);

// 选中的好友和群组ID
const selectedFriendId = ref(null);
const selectedGroupId = ref(null);

// 右键菜单相关
const chatContextMenuVisible = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const selectedChatForMenu = ref(null);

// 聊天菜单项
const chatMenuItems = computed(() => {
  if (!selectedChatForMenu.value) return [];
  
  return [
    {
      label: selectedChatForMenu.value.isPinned ? '取消置顶' : '置顶会话',
      icon: Star,
      action: 'togglePin'
    },
    {
      label: '删除会话',
      icon: Delete,
      action: 'delete',
      danger: true,
      divider: true
    }
  ];
});

// 添加好友搜索查询
const friendSearchQuery = ref('');

// 创建群组表单
const createGroupFormRef = ref(null);
const createGroupForm = ref({
  name: '',
  description: '',
  avatar: ''
});
const createGroupRules = {
  name: [
    { required: true, message: '请输入群组名称', trigger: 'blur' },
    { min: 1, max: 20, message: '长度在 1 到 20 个字符', trigger: 'blur' }
  ],
  description: [
    { max: 100, message: '最多100个字符', trigger: 'blur' }
  ]
};
const uploadingAvatar = ref(false);

// 监听搜索查询
watch(searchQuery, (newValue) => {
  // 实现本地搜索逻辑
  // TODO: 根据搜索词过滤聊天、好友和群组
});

// 切换选项卡
const handleTabChange = (tab) => {
  activeTab.value = tab;
};

// 头像加载错误处理
const avatarError = () => {
  // 使用用户名首字母作为替代
  return true;
};

// 获取姓名首字母
const getInitials = (name) => {
  if (!name) return '?';
  return name.substring(0, 2).toUpperCase();
};

// 检查聊天是否激活
const isChatActive = (chat) => {
  return msgStore.currentChat && 
         msgStore.currentChat.id === chat.id && 
         msgStore.chatType === chat.type;
};

// 根据聊天对象获取展示名称
const displayChatName = (chat) => {
  if (!chat) return '';
  return chat.name || (chat.type === 'friend' ? `用户 ${chat.id}` : `群组 ${chat.id}`);
};

// 获取聊天头像
const getChatAvatar = (chat) => {
  if (!chat) return '';
  return chat.avatar || '';
};

// 获取聊天首字母
const getChatInitials = (chat) => {
  return getInitials(chat.name || '');
};

// 格式化时间
const formatTime = (time) => {
  if (!time) return '';
  
  // 处理ISO日期时间格式（LocalDateTime返回的格式）
  const date = new Date(time);
  if (isNaN(date.getTime())) {
    console.warn('无效的时间格式:', time);
    return time; // 返回原始值，防止显示'Invalid Date'
  }
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today - messageDate) / (1000 * 60 * 60 * 24));
  
  // 今天发送的消息，显示时间
  if (diffDays === 0) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  
  // 昨天发送的消息
  if (diffDays === 1) {
    return '昨天';
  }
  
  // 一周内发送的消息，显示星期几
  if (diffDays < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[date.getDay()];
  }
  
  // 今年内的消息，显示月/日
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  }
  
  // 更早的消息，显示年/月/日
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// 格式化最后一条消息
const formatLastMessage = (message) => {
  if (!message) return '';
  
  // 根据消息类型格式化
  switch(message.messageType) {
    case 'TEXT':
      return message.content;
    case 'IMAGE':
      return '[图片]';
    case 'FILE':
      return '[文件]';
    default:
      return message.content;
  }
};

// 选择聊天
const selectChat = (chat) => {
  // 设置当前聊天
  msgStore.setCurrentChat(chat, chat.type);
  
  // 清空该会话的未读数(只在这里调用 API)
  convStore.clearUnreadCount(chat.id, chat.type, false);
  
  // 触发移动端视图切换事件
  window.dispatchEvent(new CustomEvent('chat-selected'));
};

// 开始聊天
const startChat = (target, type) => {
  // 格式化目标为聊天对象
  const chat = {
    id: target.id,
    type: type,
    name: type === 'friend' ? target.username : target.name
  };
  
  // 创建或更新会话（不是新消息，不增加未读数）
  convStore.createOrUpdateConversation({
    id: target.id,
    type: type,
    isNewMessage: false
  });
  
  // 设置为当前聊天
  msgStore.setCurrentChat(chat, type);
  
  // 清空未读数(只在这里调用 API)
  convStore.clearUnreadCount(target.id, type, false);
  
  // 切换到聊天标签
  activeTab.value = 'chats';
  
  // 触发移动端视图切换事件
  window.dispatchEvent(new CustomEvent('chat-selected'));
};

// 显示添加好友对话框
const showAddFriend = () => {
  friendSearchQuery.value = '';
  friendStore.clearSearchResults();
  addFriendDialogVisible.value = true;
};

// 显示好友申请对话框
const showPendingRequests = () => {
  // accept/reject 方法已经实时更新了 pendingRequests，不需要重新获取
  // 如果需要确保数据最新，可以在页面加载时统一获取一次
  pendingRequestsDialogVisible.value = true;
};

// 搜索用户
const searchUsers = () => {
  if (!friendSearchQuery.value.trim()) {
    ElMessage.warning('请输入用户名搜索');
    return;
  }
  
  friendStore.searchUsers(friendSearchQuery.value);
};

// 检查是否已经是好友
const isFriend = (user) => {
  return friends.value.some(friend => friend.id === user.id);
};

// 发送好友请求
const sendFriendRequest = async (userId) => {
  const success = await friendStore.sendFriendRequest(userId);
  if (success) {
    // 清空搜索结果
    friendSearchQuery.value = '';
    friendStore.clearSearchResults();
  }
};

// 接受好友请求
const acceptFriendRequest = async (requestId) => {
  await friendStore.acceptFriendRequest(requestId);
};

// 拒绝好友请求
const rejectFriendRequest = async (requestId) => {
  await friendStore.rejectFriendRequest(requestId);
};

// 删除好友确认
const deleteFriendConfirm = (friend) => {
  ElMessageBox.confirm(
    `确定要删除好友 ${friend.username} 吗？删除后将同时清空与该好友的聊天会话。`,
    '删除好友',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      distinguishCancelAndClose: true
    }
  ).then(() => {
    deleteFriend(friend.id);
  }).catch((action) => {
    if (action === 'cancel') {
      console.log('用户取消删除好友');
    }
  });
};

// 删除好友
const deleteFriend = async (friendId) => {
  await friendStore.deleteFriend(friendId);
};

// 显示创建群组对话框
const showCreateGroup = () => {
  createGroupForm.value = {
    name: '',
    description: '',
    avatar: ''
  };
  createGroupDialogVisible.value = true;
};

// 显示加入群组对话框
const showJoinGroup = () => {
  groupSearchQuery.value = '';
  groupSearchResults.value = [];
  joinGroupDialogVisible.value = true;
};

// 头像上传前验证
const beforeAvatarUpload = (file) => {
  const isImage = file.type.startsWith('image/');
  const isLt5M = file.size / 1024 / 1024 < 5;

  if (!isImage) {
    ElMessage.error('只能上传图片文件!');
    return false;
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB!');
    return false;
  }
  return true;
};

// 处理头像上传
const handleAvatarUpload = async (options) => {
  const { file } = options;
  
  uploadingAvatar.value = true;
  
  try {
    // 初始化 OSS 客户端
    if (!ossClient.client) {
      await ossClient.init();
    }
    
    // 生成文件名
    const extension = file.name.split('.').pop();
    const fileName = ossClient.generateFileName(extension);
    
    // 上传文件
    await ossClient.uploadFile(fileName, file);
    
    // 生成文件 URL
    const avatarUrl = ossClient.generateFileUrl(fileName);
    
    // 更新表单中的头像字段
    createGroupForm.value.avatar = avatarUrl;
    
    ElMessage.success('头像上传成功');
  } catch (error) {
    console.error('头像上传失败:', error);
    ElMessage.error('头像上传失败');
  } finally {
    uploadingAvatar.value = false;
  }
};

// 创建新群组
const createNewGroup = async () => {
  if (!createGroupFormRef.value) return;
  
  try {
    await createGroupFormRef.value.validate();
    
    const success = await gStore.createGroup(createGroupForm.value);
    if (success) {
      createGroupDialogVisible.value = false;
    }
  } catch (error) {
    console.error('表单验证失败', error);
  }
};

// 搜索群组
const searchGroups = async () => {
  if (!groupSearchQuery.value.trim()) {
    ElMessage.warning('请输入群组名称搜索');
    return;
  }
  
  loading.value.searchGroup = true;
  try {
    const result = await searchGroupByNameService({ nameLike: groupSearchQuery.value });
    groupSearchResults.value = result || [];
  } catch (error) {
    ElMessage.error('搜索群组失败');
    groupSearchResults.value = [];
  } finally {
    loading.value.searchGroup = false;
  }
};

// 加入群组
const joinGroup = async (groupId) => {
  const success = await gStore.joinGroup(groupId);
  if (success) {
    // joinGroup 方法已经更新了 store 中的群组列表,不需要重新加载
    ElMessage.success('已成功加入群组');
  }
};

// 检查是否是群组成员
const isGroupMember = (groupId) => {
  return gStore.isGroupMember(groupId);
};

// 检查是否是我创建的群组
const isMyGroup = (group) => {
  return group.ownerId === userInfoStore.userId;
};

// 显示用户个人信息
const showUserProfile = () => {
  userProfileDialogVisible.value = true;
};

// 显示用户设置
const showUserSettings = () => {
  ElMessage.info('个人设置功能正在开发中');
};

// 显示好友信息
const showFriendInfo = (friend) => {
  selectedFriendId.value = friend.id;
  friendInfoDialogVisible.value = true;
};

// 处理从好友信息对话框发起聊天
const handleFriendStartChat = (friend) => {
  startChat(friend, 'friend');
};

// 处理从好友信息对话框删除好友
const handleFriendDelete = async (friendId) => {
  // 好友信息对话框已经调用了 deleteFriend，这里不需要再次调用
  // 只需要确保 UI 正常更新即可
  console.log(`好友 ${friendId} 已被删除`);
};

// 显示群组信息
const showGroupInfo = (group) => {
  selectedGroupId.value = group.id;
  groupInfoDialogVisible.value = true;
};

// 处理从群组信息对话框发起私聊
const handleGroupSendMessage = (member) => {
  startChat(member, 'friend');
};

// 处理从群组信息对话框退出群组
const handleGroupLeave = (groupId) => {
  leaveGroupConfirm({ id: groupId });
};

// 退出群组确认
const leaveGroupConfirm = (group) => {
  ElMessageBox.confirm(
    `确定要退出群组 ${group.name || '该群组'} 吗？`,
    '退出群组',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    ElMessage.info('退出群组功能开发中...');
    // TODO: 调用API退出群组
  }).catch(() => {});
};

// 置顶/取消置顶会话
const togglePinChat = (chat) => {
  convStore.togglePinConversation(chat.id, chat.type);
};

// 删除会话
const deleteChat = (chat) => {
  ElMessageBox.confirm(
    '删除会话不会删除聊天记录，确定删除吗？',
    '删除会话',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    convStore.deleteConversation(chat.id, chat.type);
    
    // 如果删除的是当前聊天，清空当前聊天
    if (msgStore.currentChat && 
        msgStore.currentChat.id === chat.id && 
        msgStore.chatType === chat.type) {
      msgStore.setCurrentChat(null, 'friend');
    }
  }).catch(() => {});
};

// 退出登录
const logout = async () => {
  ElMessageBox.confirm(
    '确定要退出登录吗？',
    '退出登录',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(async () => {
    try {
      await logoutService();
    } catch (error) {
      console.error('登出接口调用失败', error);
    } finally {
      // 无论接口是否成功，都清除本地存储并退出
      authStore.clearAuth();
      userInfoStore.clearUserInfo();
      msgStore.clearMessageData();
      friendStore.clearFriendshipData();
      gStore.clearGroupData();
      convStore.clearConversationData();
      router.push('/login');
    }
  }).catch(() => {});
};

// 处理聊天右键菜单
const handleChatContextMenu = (event, chat) => {
  event.preventDefault();
  selectedChatForMenu.value = chat;
  contextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  };
  chatContextMenuVisible.value = true;
};

// 处理聊天菜单选择
const handleChatMenuSelect = (action) => {
  if (!selectedChatForMenu.value) return;
  
  switch (action) {
    case 'togglePin':
      togglePinChat(selectedChatForMenu.value);
      break;
    case 'delete':
      deleteChat(selectedChatForMenu.value);
      break;
  }
  
  selectedChatForMenu.value = null;
};
</script>


<template>
  <div class="chat-sidebar">
    <!-- 用户信息区域 -->
    <div class="user-profile">
      <el-avatar :size="40" :src="userAvatar" @error="avatarError" class="clickable-avatar" @click="showUserProfile">
        {{ userInitials }}
      </el-avatar>
      <div class="user-info" @click="showUserProfile">
        <h3>{{ username }}</h3>
        <el-tag size="small" type="info">{{ userRole === 'admin' ? '管理员' : '用户' }}</el-tag>
      </div>
      <el-dropdown trigger="click">
        <el-icon class="more-icon"><More /></el-icon>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="showUserProfile">
              <el-icon><User /></el-icon>个人信息
            </el-dropdown-item>
            <el-dropdown-item @click="showUserSettings">
              <el-icon><Setting /></el-icon>个人设置
            </el-dropdown-item>
            <el-dropdown-item @click="logout">
              <el-icon><SwitchButton /></el-icon>退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 搜索框 -->
    <div class="search-container">
      <el-input
        v-model="searchQuery"
        placeholder="搜索好友或群组"
        prefix-icon="Search"
        clearable
      />
    </div>

    <!-- 菜单 -->
    <div class="menu-container">
      <div class="chat-menu">
        <div
          class="menu-item"
          :class="{ active: activeTab === 'chats' }"
          @click="handleTabChange('chats')"
        >
          <el-icon><ChatDotRound /></el-icon>
          <span>聊天</span>
        </div>
        <div
          class="menu-item"
          :class="{ active: activeTab === 'friends' }"
          @click="handleTabChange('friends')"
        >
          <el-icon><UserFilled /></el-icon>
          <span>好友</span>
        </div>
        <div
          class="menu-item"
          :class="{ active: activeTab === 'groups' }"
          @click="handleTabChange('groups')"
        >
          <el-icon><Collection /></el-icon>
          <span>群组</span>
        </div>
      </div>
    </div>

    <!-- 列表区域 -->
    <div class="list-container">
      <!-- 聊天列表 -->
      <div v-if="activeTab === 'chats'" class="chat-list">
        <template v-if="chatList.length > 0">
          <div
            v-for="chat in chatList"
            :key="`${chat.type}_${chat.id}`"
            class="chat-item"
            :class="{ active: isChatActive(chat), 'robot-chat': chat.role === 'ROBOT' }"
            @click="selectChat(chat)"
            @contextmenu.prevent="handleChatContextMenu($event, chat)"
          >
            <div class="friend-avatar-wrapper">
              <el-avatar :size="36" :src="getChatAvatar(chat)" shape="square">
                {{ getChatInitials(chat) }}
              </el-avatar>
              <span v-if="chat.type === 'friend' && isFriendOnline(chat.id)" class="online-indicator"></span>
              <!-- Robot 标识 -->
              <span v-if="chat.role === 'ROBOT'" class="robot-badge">AI</span>
            </div>
            <div class="chat-item-content">
              <div class="chat-item-header">
                <div class="chat-item-title">
                  <el-icon v-if="chat.isPinned" class="pin-icon"><StarFilled /></el-icon>
                  <h4>
                    {{ displayChatName(chat) }}
                    <el-icon v-if="chat.role === 'ROBOT'" class="robot-icon" :size="14">
                      <ChatDotRound />
                    </el-icon>
                  </h4>
                </div>
                <span class="time">{{ formatTime(chat.lastMessageTime) }}</span>
              </div>
              <div class="chat-item-message">
                <p>{{ formatLastMessage(chat.lastMessage) }}</p>
                <el-badge v-if="chat.unreadCount" :value="chat.unreadCount" class="unread-badge" />
              </div>
            </div>
          </div>
        </template>
        <el-empty v-else description="暂无聊天记录" />
      </div>

      <!-- 聊天右键菜单 -->
      <ContextMenu
        v-model:visible="chatContextMenuVisible"
        :position="contextMenuPosition"
        :menu-items="chatMenuItems"
        @select="handleChatMenuSelect"
      />

      <!-- 好友列表 -->
      <div v-if="activeTab === 'friends'" class="friends-container">
        <!-- 好友操作 -->
        <div class="friend-actions">
          <el-button type="primary" size="small" @click="showAddFriend">
            <el-icon><Plus /></el-icon>添加好友
          </el-button>
          <el-button v-if="pendingRequestsCount > 0" type="info" size="small" @click="showPendingRequests">
            好友申请 <el-badge :value="pendingRequestsCount" />
          </el-button>
        </div>
        
        <!-- 好友列表 -->
        <div class="friend-list">
          <template v-if="friends.length > 0">
            <div
              v-for="friend in friends"
              :key="friend.id"
              class="friend-item"
              :class="{ 'robot-friend': friend.role === 'ROBOT' }"
              @click="startChat(friend, 'friend')"
            >
              <div class="friend-avatar-wrapper">
                <el-avatar :size="36" :src="friend.avatar">
                  {{ getInitials(friend.username) }}
                </el-avatar>
                <span v-if="isFriendOnline(friend.id)" class="online-indicator"></span>
                <!-- Robot 标识 -->
                <span v-if="friend.role === 'ROBOT'" class="robot-badge">AI</span>
              </div>
              <div class="friend-info">
                <h4>
                  {{ friend.username }}
                  <el-icon v-if="friend.role === 'ROBOT'" class="robot-icon" :size="14">
                    <ChatDotRound />
                  </el-icon>
                </h4>
                <p v-if="friend.signature">{{ friend.signature }}</p>
              </div>
              <el-dropdown trigger="click" @click.stop>
                <el-icon class="item-more-icon" @click.stop><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="showFriendInfo(friend)">
                      <el-icon><InfoFilled /></el-icon>查看信息
                    </el-dropdown-item>
                    <el-dropdown-item @click="startChat(friend, 'friend')">
                      <el-icon><ChatDotRound /></el-icon>发送消息
                    </el-dropdown-item>
                    <el-dropdown-item @click="deleteFriendConfirm(friend)" divided>
                      <el-icon><Delete /></el-icon>删除好友
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
          <el-empty v-else description="暂无好友" />
        </div>
      </div>

      <!-- 群组列表 -->
      <div v-if="activeTab === 'groups'" class="groups-container">
        <!-- 群组操作 -->
        <div class="group-actions">
          <el-button type="primary" size="small" @click="showCreateGroup">
            <el-icon><Plus /></el-icon>创建群组
          </el-button>
          <el-button type="info" size="small" @click="showJoinGroup">
            <el-icon><Position /></el-icon>加入群组
          </el-button>
        </div>
        
        <!-- 群组列表 -->
        <div class="group-list">
          <!-- 我创建的群组 -->
          <div>
            <div class="group-category-header" @click="showCreatedGroups = !showCreatedGroups">
              <el-icon><Collection /></el-icon>
              <span>我创建的群组 ({{ createdGroups.length }})</span>
              <el-icon><component :is="showCreatedGroups ? 'ArrowDown' : 'ArrowRight'" /></el-icon>
            </div>
            <div v-show="showCreatedGroups">
              <template v-if="createdGroups.length > 0">
                <div v-for="group in createdGroups" :key="group.id" class="group-item" @click="startChat(group, 'group')">
                  <el-avatar :size="36" shape="square" :src="group.avatar">
                    {{ getInitials(group.name) }}
                  </el-avatar>
                  <div class="group-info">
                    <h4>{{ group.name }}</h4>
                    <p>{{ group.members.length }}人</p>
                  </div>
                  <el-dropdown trigger="click" @click.stop>
                    <el-icon class="item-more-icon" @click.stop><MoreFilled /></el-icon>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="showGroupInfo(group)">
                          <el-icon><InfoFilled /></el-icon>查看详情
                        </el-dropdown-item>
                        <el-dropdown-item @click="startChat(group, 'group')">
                          <el-icon><ChatDotRound /></el-icon>进入群聊
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </template>
              <el-empty v-else description="暂无我创建的群组" />
            </div>
          </div>
          <!-- 我管理的群组 -->
          <div>
            <div class="group-category-header" @click="showManagedGroups = !showManagedGroups">
              <el-icon><Collection /></el-icon>
              <span>我管理的群组 ({{ managedGroups.length }})</span>
              <el-icon><component :is="showManagedGroups ? 'ArrowDown' : 'ArrowRight'" /></el-icon>
            </div>
            <div v-show="showManagedGroups">
              <template v-if="managedGroups.length > 0">
                <div v-for="group in managedGroups" :key="group.id" class="group-item" @click="startChat(group, 'group')">
                  <el-avatar :size="36" shape="square" :src="group.avatar">
                    {{ getInitials(group.name) }}
                  </el-avatar>
                  <div class="group-info">
                    <h4>{{ group.name }}</h4>
                    <p>{{ group.members.length }}人</p>
                  </div>
                  <el-dropdown trigger="click" @click.stop>
                    <el-icon class="item-more-icon" @click.stop><MoreFilled /></el-icon>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="showGroupInfo(group)">
                          <el-icon><InfoFilled /></el-icon>查看详情
                        </el-dropdown-item>
                        <el-dropdown-item @click="startChat(group, 'group')">
                          <el-icon><ChatDotRound /></el-icon>进入群聊
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </template>
              <el-empty v-else description="暂无我管理的群组" />
            </div>
          </div>
          <!-- 我加入的群组 -->
          <div>
            <div class="group-category-header" @click="showJoinedGroups = !showJoinedGroups">
              <el-icon><Collection /></el-icon>
              <span>我加入的群组 ({{ joinedGroups.length }})</span>
              <el-icon><component :is="showJoinedGroups ? 'ArrowDown' : 'ArrowRight'" /></el-icon>
            </div>
            <div v-show="showJoinedGroups">
              <template v-if="joinedGroups.length > 0">
                <div v-for="group in joinedGroups" :key="group.id" class="group-item" @click="startChat(group, 'group')">
                  <el-avatar :size="36" shape="square" :src="group.avatar">
                    {{ getInitials(group.name) }}
                  </el-avatar>
                  <div class="group-info">
                    <h4>{{ group.name }}</h4>
                    <p>{{ group.members.length }}人</p>
                  </div>
                  <el-dropdown trigger="click" @click.stop>
                    <el-icon class="item-more-icon" @click.stop><MoreFilled /></el-icon>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="showGroupInfo(group)">
                          <el-icon><InfoFilled /></el-icon>查看详情
                        </el-dropdown-item>
                        <el-dropdown-item @click="startChat(group, 'group')">
                          <el-icon><ChatDotRound /></el-icon>进入群聊
                        </el-dropdown-item>
                        <el-dropdown-item @click="leaveGroupConfirm(group)" divided>
                          <el-icon><RemoveFilled /></el-icon>退出群组
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </template>
              <el-empty v-else description="暂无我加入的群组" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加好友对话框 -->
    <el-dialog
      v-model="addFriendDialogVisible"
      title="添加好友"
      width="400px"
      :append-to-body="true"
      destroy-on-close
    >
      <div class="search-user-container">
        <div class="search-form">
          <el-input
            v-model="friendSearchQuery"
            placeholder="输入用户名搜索"
            prefix-icon="Search"
            clearable
            @keyup.enter="searchUsers"
          />
          <el-button type="primary" @click="searchUsers" :loading="loading.search">搜索</el-button>
        </div>
        
        <div class="search-results" v-loading="loading.search">
          <template v-if="searchResults.length > 0">
            <div
              v-for="user in searchResults"
              :key="user.id"
              class="search-result-item"
            >
              <el-avatar :size="36" :src="user.avatar">
                {{ getInitials(user.username) }}
              </el-avatar>
              <div class="user-info">
                <h4>{{ user.username }}</h4>
                <p v-if="user.signature">{{ user.signature }}</p>
              </div>
              <el-button
                :type="isFriend(user) ? 'info' : 'primary'"
                size="small"
                :disabled="isFriend(user)"
                @click="sendFriendRequest(user.id)"
              >
                {{ isFriend(user) ? '已是好友' : '添加好友' }}
              </el-button>
            </div>
          </template>
          <el-empty v-else-if="!loading.search && friendSearchQuery" description="未找到匹配的用户" />
          <el-empty v-else description="请输入用户名搜索" />
        </div>
      </div>
    </el-dialog>

    <!-- 好友申请对话框 -->
    <el-dialog
      v-model="pendingRequestsDialogVisible"
      title="好友申请"
      width="400px"
      :append-to-body="true"
      destroy-on-close
    >
      <div class="pending-requests" v-loading="loading.pending">
        <template v-if="pendingRequests.length > 0">
          <div
            v-for="request in pendingRequests"
            :key="request.id"
            class="pending-request-item"
          >
            <el-avatar :size="36" :src="request.avatar">
              {{ getInitials(request.username) }}
            </el-avatar>
            <div class="user-info">
              <h4>{{ request.username }}</h4>
              <p v-if="request.signature">{{ request.signature }}</p>
            </div>
            <div class="request-actions">
              <el-button
                type="primary"
                size="small"
                @click="acceptFriendRequest(request.id)"
              >
                接受
              </el-button>
              <el-button
                type="danger"
                size="small"
                @click="rejectFriendRequest(request.id)"
              >
                拒绝
              </el-button>
            </div>
          </div>
        </template>
        <el-empty v-else description="暂无好友申请" />
      </div>
    </el-dialog>

    <!-- 创建群组对话框 -->
    <el-dialog
      v-model="createGroupDialogVisible"
      title="创建群组"
      width="400px"
      :append-to-body="true"
      destroy-on-close
    >
      <el-form
        ref="createGroupFormRef"
        :model="createGroupForm"
        :rules="createGroupRules"
        label-width="80px"
      >
        <el-form-item label="群组头像" prop="avatar">
          <div class="avatar-upload-container">
            <el-avatar 
              :size="80" 
              shape="square" 
              :src="createGroupForm.avatar"
              class="avatar-preview"
            >
              {{ getInitials(createGroupForm.name || '新群组') }}
            </el-avatar>
            <el-upload
              :show-file-list="false"
              :before-upload="beforeAvatarUpload"
              :http-request="handleAvatarUpload"
              accept="image/*"
              class="avatar-uploader"
            >
              <el-button size="small" :loading="uploadingAvatar">
                <el-icon v-if="!uploadingAvatar"><Upload /></el-icon>
                {{ uploadingAvatar ? '上传中...' : '上传头像' }}
              </el-button>
            </el-upload>
          </div>
          <div class="upload-tip">支持 jpg、png 格式，大小不超过 5MB</div>
        </el-form-item>
        <el-form-item label="群组名称" prop="name">
          <el-input v-model="createGroupForm.name" maxlength="20" show-word-limit />
        </el-form-item>
        <el-form-item label="群组描述" prop="description">
          <el-input
            v-model="createGroupForm.description"
            type="textarea"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createGroupDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createNewGroup" :loading="loading.create">创建</el-button>
      </template>
    </el-dialog>

    <!-- 加入群组对话框 -->
    <el-dialog
      v-model="joinGroupDialogVisible"
      title="加入群组"
      width="400px"
      :append-to-body="true"
      destroy-on-close
    >
      <div class="search-group-container">
        <div class="search-form">
          <el-input
            v-model="groupSearchQuery"
            placeholder="输入群组名称搜索"
            prefix-icon="Search"
            clearable
            @keyup.enter="searchGroups"
          />
          <el-button type="primary" @click="searchGroups" :loading="loading.searchGroup">搜索</el-button>
        </div>
        
        <div class="search-results" v-loading="loading.searchGroup">
          <template v-if="groupSearchResults.length > 0">
            <div
              v-for="group in groupSearchResults"
              :key="group.id"
              class="search-result-item"
            >
              <el-avatar :size="36" shape="square" :src="group.avatar">
                {{ getInitials(group.name) }}
              </el-avatar>
              <div class="group-info">
                <h4>{{ group.name }}</h4>
                <p>{{ group.description || '暂无描述' }}</p>
              </div>
              <el-button
                :type="isGroupMember(group.id) ? 'info' : 'primary'"
                size="small"
                :disabled="isGroupMember(group.id)"
                @click="joinGroup(group.id)"
              >
                {{ isGroupMember(group.id) ? '已加入' : '加入' }}
              </el-button>
            </div>
          </template>
          <el-empty v-else-if="!loading.searchGroup && groupSearchQuery" description="未找到匹配的群组" />
          <el-empty v-else description="请输入群组名称搜索" />
        </div>
      </div>
    </el-dialog>

    <!-- 用户个人信息对话框 -->
    <UserProfileDialog v-model="userProfileDialogVisible" @close="userProfileDialogVisible = false" />

    <!-- 好友信息对话框 -->
    <FriendInfoDialog 
      v-model="friendInfoDialogVisible" 
      :friend-id="selectedFriendId"
      @close="friendInfoDialogVisible = false"
      @startChat="handleFriendStartChat"
      @delete="handleFriendDelete"
    />

    <!-- 群组信息对话框 -->
    <GroupInfoDialog 
      v-model="groupInfoDialogVisible" 
      :group-id="selectedGroupId"
      @close="groupInfoDialogVisible = false"
      @sendMessage="handleGroupSendMessage"
      @leave="handleGroupLeave"
    />
  </div>
</template>

<style scoped>
/* 群组分组标题样式 */
.group-category-header {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 8px 16px;
  font-weight: 500;
  font-size: 15px;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color-extra-light);
  gap: 8px;
}
.chat-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);
  position: relative;
}

/* 用户信息区域 */
.user-profile {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color-overlay);
}

.clickable-avatar {
  cursor: pointer;
  transition: transform 0.2s;
}

.clickable-avatar:hover {
  transform: scale(1.05);
}

.user-info {
  flex: 1;
  margin-left: 12px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.user-info:hover {
  opacity: 0.8;
}

.user-info h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-icon {
  font-size: 20px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

/* 搜索框 */
.search-container {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

/* 菜单 */
.menu-container {
  border-bottom: 1px solid var(--el-border-color-light);
}

.chat-menu {
  display: flex;
  justify-content: space-around;
  background-color: var(--el-bg-color);
  height: 44px;
  align-items: center;
}
.menu-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0 16px;
  height: 100%;
  font-size: 15px;
  color: var(--el-text-color-secondary);
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
}
.menu-item.active {
  color: var(--el-color-primary);
  border-bottom: 2px solid var(--el-color-primary);
  background-color: var(--el-bg-color-page);
}

/* 列表容器 */
.list-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

/* 自定义滚动条样式 */
.list-container::-webkit-scrollbar {
  width: 4px;
}

.list-container::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 2px;
}

.list-container::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
  transition: background 0.3s;
}

.list-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* Firefox 滚动条样式 */
.list-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

/* 聊天列表 */
.chat-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.3s;
  position: relative;
}

.chat-item:hover {
  background-color: var(--el-bg-color-page);
}

.chat-item.active {
  background-color: var(--el-color-primary-light-9);
}

.chat-item-more {
  font-size: 18px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  opacity: 0;
  transition: all 0.3s;
  margin-left: 8px;
}

.chat-item:hover .chat-item-more {
  opacity: 1;
}

.chat-item-more:hover {
  color: var(--el-color-primary);
}

.chat-item-content {
  flex: 1;
  margin-left: 12px;
  overflow: hidden;
}

.chat-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-item-title {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.pin-icon {
  font-size: 14px;
  color: var(--el-color-warning);
  flex-shrink: 0;
}

.chat-item-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item-header .time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.chat-item-message {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-item-message p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70%;
}

/* 好友容器 */
.friends-container, .groups-container {
  display: flex;
  flex-direction: column;
}

.friend-actions, .group-actions {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  background-color: var(--el-bg-color-overlay);
}

.friend-item, .group-item, .pending-request-item, .search-result-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.3s;
  position: relative;
}

.friend-item:hover, .group-item:hover {
  background-color: var(--el-bg-color-page);
}

.item-more-icon {
  font-size: 18px;
  color: var(--el-text-color-secondary);
  transition: all 0.3s;
  opacity: 0;
}

.friend-item:hover .item-more-icon,
.group-item:hover .item-more-icon {
  opacity: 1;
}

.item-more-icon:hover {
  color: var(--el-color-primary);
  transform: scale(1.1);
}

.friend-info, .group-info, .user-info {
  flex: 1;
  margin-left: 12px;
  overflow: hidden;
}

.friend-info h4, .group-info h4, .user-info h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.friend-info p, .group-info p, .user-info p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 在线状态指示器 */
.friend-avatar-wrapper {
  position: relative;
  display: inline-block;
}

.online-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background-color: #67c23a;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.2);
}

/* Robot 标识样式 */
.robot-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  padding: 1px 4px;
  font-size: 10px;
  font-weight: bold;
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  border: 1px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  z-index: 1;
}

.robot-icon {
  margin-left: 4px;
  color: #667eea;
  vertical-align: middle;
}

.robot-friend {
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.05) 0%, transparent 100%);
}

.robot-chat {
  border-left: 3px solid #667eea;
}

.robot-chat.active {
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.15) 0%, var(--el-color-primary-light-9) 100%);
}

/* 对话框样式 */
.search-form {
  display: flex;
  margin-bottom: 16px;
}

.search-form .el-input {
  flex: 1;
  margin-right: 8px;
}

.search-results, .pending-requests {
  max-height: 300px;
  overflow-y: auto;
}

.request-actions {
  display: flex;
  gap: 8px;
}

/* 头像上传样式 */
.avatar-upload-container {
  display: flex;
  align-items: center;
  gap: 20px;
}

.avatar-preview {
  border: 2px solid var(--el-border-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.avatar-uploader {
  flex: 1;
}

.upload-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .chat-sidebar {
    width: 100%;
    border-right: none;
  }
  
  .sidebar-header {
    padding: 12px;
    height: var(--mobile-header-height, 56px);
  }
  
  .sidebar-tabs {
    padding: 0 8px;
  }
  
  .list-container {
    max-height: calc(100vh - 120px);
    padding: 0 8px;
  }
  
  .list-item {
    padding: 10px;
  }
  
  .item-avatar {
    width: 40px;
    height: 40px;
  }
  
  .friend-info h4, .group-info h4, .user-info h4 {
    font-size: 13px;
  }
  
  .friend-info p, .group-info p, .user-info p {
    font-size: 11px;
  }
  
  /* 对话框使用全局 dialog-mobile.css */
  
  .search-results, .pending-requests {
    max-height: 50vh;
  }
}

@media (max-width: 480px) {
  .sidebar-header h2 {
    font-size: 18px;
  }
  
  .header-actions {
    gap: 8px;
  }
  
  .action-button {
    width: 36px;
    height: 36px;
  }
}
</style>