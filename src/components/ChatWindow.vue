<template>
  <div class="chat-window" v-loading="loading">
    <div v-if="currentChat" class="chat-window-content">
      <!-- 聊天标题 -->
      <div class="chat-header">
        <div class="chat-title">
          <div class="title-container">
            <el-avatar :size="36" :src="chatAvatar" class="chat-avatar">
              {{ chatInitials }}
            </el-avatar>
            <div class="title-info">
              <h3>{{ chatTitle }}</h3>
              <span v-if="currentChat.type === 'group'" class="chat-subtitle">
                {{ groupMembers.length }}人
              </span>
              <span v-else class="chat-status" :class="{ 'online': isUserOnline }">
                {{ isUserOnline ? '在线' : '离线' }}
              </span>
            </div>
          </div>
        </div>
        <div class="chat-actions">
          <el-tooltip content="搜索消息" placement="bottom">
            <el-icon class="action-icon"><Search /></el-icon>
          </el-tooltip>
          <el-dropdown trigger="click">
            <el-icon class="more-icon"><More /></el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="showChatInfo">
                  <el-icon><InfoFilled /></el-icon> 查看信息
                </el-dropdown-item>
                <el-dropdown-item v-if="currentChat.type === 'group'" @click="leaveGroup">
                  <el-icon><RemoveFilled /></el-icon> 退出群组
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      
      <!-- 聊天消息列表 -->
      <div class="chat-messages" ref="messagesContainerRef">
        <transition-group name="fade-slide" tag="div">
          <div v-if="messages.length === 0" key="empty" class="empty-messages">
            <el-empty description="暂无消息">
              <template #image>
                <div class="empty-illustration">
                  <el-icon class="empty-icon"><ChatDotRound /></el-icon>
                  <div class="empty-hint">开始对话吧</div>
                </div>
              </template>
            </el-empty>
          </div>
          
          <template v-else>
            <div
              v-for="(message, index) in messages"
              :key="message.id"
              class="message-container"
              :class="{ 
                'own-message': isOwnMessage(message),
                'first-of-group': isFirstMessageOfGroup(message, index),
                'last-of-group': isLastMessageOfGroup(message, index)
              }"
            >
              <!-- 显示日期分隔符 -->
              <div 
                v-if="shouldShowDateDivider(message, index)"
                class="date-divider"
              >
                <div class="date-line">
                  <span class="date-text">{{ formatDate(message.sendAt) }}</span>
                </div>
              </div>
              
              <div class="message-wrapper">
                <!-- 他人消息布局：头像 - 内容区(消息+时间) -->
                <template v-if="!isOwnMessage(message)">
                  <el-avatar 
                    :size="40" 
                    :src="getSenderAvatar(message)"
                    class="message-avatar left-avatar"
                    :class="{ 'invisible-avatar': !isLastMessageOfGroup(message, index) }"
                  >
                    {{ getSenderInitials(message) }}
                  </el-avatar>
                  
                  <div class="message-content">
                    <!-- 发送者名称 (群聊中) -->
                    <div 
                      v-if="currentChat.type === 'group' && isFirstMessageOfGroup(message, index)" 
                      class="message-sender"
                    >
                      {{ getSenderName(message) }}
                    </div>
                    
                    <div class="message-row">
                      <div class="message-bubble" :class="'message-type-' + message.messageType.toLowerCase()">
                        <!-- 根据消息类型显示内容 -->
                        <template v-if="message.messageType === 'TEXT'">
                          <div class="text-message">{{ message.content }}</div>
                        </template>
                        <template v-else-if="message.messageType === 'IMAGE'">
                          <div class="image-message">
                            <el-image 
                              :src="message.content" 
                              :preview-src-list="[message.content]"
                              fit="cover"
                              loading="lazy"
                              class="message-image"
                            >
                              <template #placeholder>
                                <div class="image-loading">
                                  <el-icon class="is-loading"><Loading /></el-icon>
                                </div>
                              </template>
                              <template #error>
                                <div class="image-error">
                                  <el-icon><Picture /></el-icon>
                                  <span>图片加载失败</span>
                                </div>
                              </template>
                            </el-image>
                          </div>
                        </template>
                        <template v-else-if="message.messageType === 'FILE'">
                          <div class="file-message">
                            <div class="file-icon">
                              <el-icon><Document /></el-icon>
                            </div>
                            <div class="file-info">
                              <div class="file-name">{{ getFileName(message.content) }}</div>
                              <div class="file-actions">
                                <el-button size="small" type="primary" plain @click="downloadFile(message.content)">
                                  <el-icon><Download /></el-icon> 下载
                                </el-button>
                              </div>
                            </div>
                          </div>
                        </template>
                      </div>
                      
                      <!-- 时间 -->
                      <div class="message-meta">
                        <span class="message-time">{{ formatTime(message.sendAt) }}</span>
                      </div>
                    </div>
                  </div>
                </template>
                
                <!-- 自己消息布局：内容区(时间+消息) - 头像 -->
                <template v-else>
                  <div class="message-content">
                    <div class="message-row">
                      <!-- 时间和状态 -->
                      <div class="message-meta">
                        <span class="message-status">
                          <el-icon v-if="message.status === 'sending'" class="status-icon is-loading"><Loading /></el-icon>
                          <el-icon v-else-if="message.status === 'failed'" class="status-icon status-failed"><Warning /></el-icon>
                          <el-icon v-else-if="message.status === 'sent'" class="status-icon"><Check /></el-icon>
                          <el-icon v-else-if="message.status === 'delivered'" class="status-icon status-delivered"><CircleCheck /></el-icon>
                          <el-icon v-else-if="message.status === 'read'" class="status-icon status-read"><CircleCheck /></el-icon>
                        </span>
                        <span class="message-time">{{ formatTime(message.sendAt) }}</span>
                      </div>
                      
                      <div class="message-bubble" :class="'message-type-' + message.messageType.toLowerCase()">
                        <!-- 根据消息类型显示内容 -->
                        <template v-if="message.messageType === 'TEXT'">
                          <div class="text-message">{{ message.content }}</div>
                        </template>
                        <template v-else-if="message.messageType === 'IMAGE'">
                          <div class="image-message">
                            <el-image 
                              :src="message.content" 
                              :preview-src-list="[message.content]"
                              fit="cover"
                              loading="lazy"
                              class="message-image"
                            >
                              <template #placeholder>
                                <div class="image-loading">
                                  <el-icon class="is-loading"><Loading /></el-icon>
                                </div>
                              </template>
                              <template #error>
                                <div class="image-error">
                                  <el-icon><Picture /></el-icon>
                                  <span>图片加载失败</span>
                                </div>
                              </template>
                            </el-image>
                          </div>
                        </template>
                        <template v-else-if="message.messageType === 'FILE'">
                          <div class="file-message">
                            <div class="file-icon">
                              <el-icon><Document /></el-icon>
                            </div>
                            <div class="file-info">
                              <div class="file-name">{{ getFileName(message.content) }}</div>
                              <div class="file-actions">
                                <el-button size="small" type="primary" plain @click="downloadFile(message.content)">
                                  <el-icon><Download /></el-icon> 下载
                                </el-button>
                              </div>
                            </div>
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>
                  
                  <el-avatar 
                    :size="40" 
                    :src="userAvatar"
                    class="message-avatar right-avatar"
                    :class="{ 'invisible-avatar': !isLastMessageOfGroup(message, index) }"
                  >
                    {{ userInitials }}
                  </el-avatar>
                </template>
              </div>
            </div>
          </template>
        </transition-group>
      </div>
      
      <!-- 消息输入框 -->
      <div class="chat-input">
        <!-- 工具栏 -->
        <div class="input-toolbar">
          <div class="toolbar-left">
            <el-tooltip content="表情" placement="top">
              <el-popover
                              placement="top"
                              :width="340"
                              trigger="click"
              >
                <template #reference>
                  <span class="toolbar-icon emoji-button">😊</span>
                </template>
                <div class="emoji-picker">
                  <div v-for="emoji in emojiList" :key="emoji" class="emoji-item" @click="insertEmoji(emoji)">
                    {{ emoji }}
                  </div>
                </div>
              </el-popover>
            </el-tooltip>
            <el-tooltip content="发送图片" placement="top">
              <el-icon class="toolbar-icon" @click="triggerImageUpload"><Picture /></el-icon>
            </el-tooltip>
            <el-tooltip content="发送文件" placement="top">
              <el-icon class="toolbar-icon" @click="triggerFileUpload"><FolderOpened /></el-icon>
            </el-tooltip>
          </div>
          
          <input
            type="file"
            ref="imageInputRef"
            accept="image/*"
            style="display: none"
            @change="handleImageUpload"
          />
          <input
            type="file"
            ref="fileInputRef"
            style="display: none"
            @change="handleFileUpload"
          />
        </div>
        
        <!-- 文本区域 -->
        <div class="input-container">
          <div class="textarea-wrapper" :class="{ 'focused': isInputFocused }">
            <el-input
              v-model="messageInput"
              type="textarea"
              :rows="1"
              :autosize="{ minRows: 1, maxRows: 1 }"
              resize="none"
              placeholder="输入消息..."
              @keydown.enter.exact.prevent="sendMessage"
              @keydown.shift.enter.prevent="handleShiftEnter"
              @focus="isInputFocused = true"
              @blur="isInputFocused = false"
              ref="messageInputRef"
              class="message-textarea"
            />
          </div>
          <div class="input-actions">
            <el-tooltip content="发送消息" placement="top">
              <el-button
                type="primary"
                class="send-button"
                :disabled="!messageInput.trim()"
                @click="sendMessage"
                :loading="sendLoading"
              >
                发送
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="empty-chat">
      <el-empty description="选择一个聊天开始会话">
        <template #image>
          <el-icon class="empty-icon"><ChatDotRound /></el-icon>
        </template>
      </el-empty>
    </div>

    <!-- 查看聊天信息的对话框 -->
    <el-dialog
      v-model="chatInfoDialogVisible"
      :title="chatInfoTitle"
      width="480px"
      :append-to-body="true"
      destroy-on-close
      class="chat-info-dialog"
    >
      <div v-if="currentChat" class="chat-info-container">
        <!-- 好友信息 -->
        <template v-if="currentChat.type === 'friend'">
          <div class="chat-info-profile">
            <el-avatar :size="100" :src="chatAvatar" class="profile-avatar">
              {{ getInitials(currentChat.name) }}
            </el-avatar>
            <div class="profile-status" :class="{ 'online': isUserOnline }"></div>
            <h2>{{ currentChat.name }}</h2>
            <p v-if="friendInfo.username && friendInfo.username !== friendInfo.nickname" class="profile-username">
              @{{ friendInfo.username }}
            </p>
          </div>
          
          <el-tabs>
            <el-tab-pane label="基本信息">
              <div class="info-section">
                <div class="info-item">
                  <span class="info-label">用户名</span>
                  <span class="info-value">{{ friendInfo.username }}</span>
                </div>
                <div class="info-item" v-if="friendInfo.bio">
                  <span class="info-label">个人简介</span>
                  <span class="info-value">{{ friendInfo.bio || '暂无简介' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">成为好友时间</span>
                  <span class="info-value">{{ formatDate(friendInfo.createdAt) }}</span>
                </div>
              </div>
              
              <div class="action-buttons">
                <el-button type="danger" plain icon="Delete">删除好友</el-button>
                <el-button type="info" plain icon="MuteNotification">消息免打扰</el-button>
              </div>
            </el-tab-pane>
            <el-tab-pane label="媒体文件">
              <div class="media-section">
                <div class="section-title">共享的媒体文件</div>
                <div class="media-empty">
                  <el-icon><Picture /></el-icon>
                  <span>暂无共享媒体文件</span>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </template>
        
        <!-- 群组信息 -->
        <template v-else-if="currentChat.type === 'group'">
          <div class="chat-info-profile">
            <el-avatar :size="100" shape="square" :src="chatAvatar" class="profile-avatar">
              {{ getInitials(currentChat.name) }}
            </el-avatar>
            <h2>{{ currentChat.name }}</h2>
            <div class="group-id">群号：{{ currentChat.id }}</div>
            <p class="group-description">{{ groupInfo.description || '暂无描述' }}</p>
            <div class="group-stats">
              <div class="stat-item">
                <el-icon><UserFilled /></el-icon>
                <span>{{ groupMembers.length }}人</span>
              </div>
              <div class="stat-item">
                <el-icon><Calendar /></el-icon>
                <span>创建于 {{ formatDate(groupInfo.createdAt) }}</span>
              </div>
            </div>
          </div>
          
          <el-tabs>
            <el-tab-pane label="成员">
              <div class="group-members">
                <div class="members-header">
                  <h4>群成员 ({{ groupMembers.length }})</h4>
                  <el-input
                    v-model="memberSearchKeyword"
                    placeholder="搜索成员"
                    prefix-icon="Search"
                    clearable
                    class="member-search"
                  />
                </div>
                
                <div class="members-list">
                  <div
                    v-for="member in filteredGroupMembers"
                    :key="member.id"
                    class="member-item"
                  >
                    <el-avatar :size="40" :src="member.avatar" class="member-avatar">
                      {{ getInitials(member.username) }}
                    </el-avatar>
                    <div class="member-info">
                      <div class="member-name">
                        {{ member.nickname || member.username }}
                        <el-tag size="small" v-if="isGroupOwner(member.id)" type="danger" class="role-tag">群主</el-tag>
                        <el-tag size="small" v-else-if="isGroupAdmin(member.id)" type="warning" class="role-tag">管理员</el-tag>
                      </div>
                      <div class="member-status" :class="{ 'online': isUserOnline }">
                        {{ isUserOnline ? '在线' : '离线' }}
                      </div>
                    </div>
                    <div class="member-actions">
                      <el-dropdown trigger="click" v-if="isCurrentUserAdmin">
                        <el-icon class="action-icon"><More /></el-icon>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item>私聊</el-dropdown-item>
                            <el-dropdown-item v-if="isGroupOwner(currentUserId) && !isGroupOwner(member.id)">设为管理员</el-dropdown-item>
                            <el-dropdown-item v-if="canRemoveMember(member.id)" type="danger">移出群组</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>
            <el-tab-pane label="媒体文件">
              <div class="media-section">
                <div class="section-title">群共享文件</div>
                <div class="media-empty">
                  <el-icon><Document /></el-icon>
                  <span>暂无群共享文件</span>
                </div>
              </div>
            </el-tab-pane>
            <el-tab-pane label="设置" v-if="isCurrentUserAdmin">
              <div class="group-settings">
                <div class="settings-section">
                  <h4>基本设置</h4>
                  <el-form label-position="top">
                    <el-form-item label="群组名称">
                      <el-input v-model="groupEditName" placeholder="输入新群组名称" />
                    </el-form-item>
                    <el-form-item label="群组描述">
                      <el-input type="textarea" v-model="groupEditDescription" placeholder="输入群组描述" :rows="3" />
                    </el-form-item>
                    <el-form-item>
                      <el-button type="primary" :loading="updatingGroup">保存修改</el-button>
                    </el-form-item>
                  </el-form>
                </div>
                
                <div class="danger-zone">
                  <h4>危险区域</h4>
                  <el-button type="danger" @click="leaveGroup">退出群组</el-button>
                  <el-button v-if="isGroupOwner(currentUserId)" type="danger" plain>解散群组</el-button>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  ChatDotRound, More, Picture, Document, 
  Folder, FolderOpened, Check, CircleCheck, Loading, Warning, 
  Search, Download, Calendar, UserFilled, InfoFilled, RemoveFilled
} from '@element-plus/icons-vue';
import { messageStore } from '@/store/message';
import { friendshipStore } from '@/store/friendship';
import { groupStore } from '@/store/group';
import { useUserInfoStore } from '@/store/userInfo';

// Store实例
const msgStore = messageStore();
const friendStore = friendshipStore();
const gStore = groupStore();
const userInfoStore = useUserInfoStore();

// DOM引用
const messagesContainerRef = ref(null);
const imageInputRef = ref(null);
const fileInputRef = ref(null);

// 用户信息
const userAvatar = computed(() => userInfoStore.avatar);
const userInitials = computed(() => getInitials(userInfoStore.username));
const currentUserId = computed(() => userInfoStore.userId);

// 消息相关数据
const messages = computed(() => msgStore.getCurrentChatMessages);
const currentChat = computed(() => msgStore.currentChat);
const chatType = computed(() => msgStore.chatType);
const loading = computed(() => msgStore.loading.messages);
const sendLoading = computed(() => msgStore.loading.send);

// 输入数据
const messageInput = ref('');

// 对话框控制
const chatInfoDialogVisible = ref(false);
const isInputFocused = ref(false);
const messageInputRef = ref(null);
const memberSearchKeyword = ref('');
const groupEditName = ref('');
const groupEditDescription = ref('');
const updatingGroup = ref(false);

// 表情选择器数据
const emojiList = ref(['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤔', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '❤️', '🧡', '💛', '💚', '💙', '💜']);

// 计算消息框行数
const messageRows = computed(() => {
  if (!messageInput.value) return 3;
  const lines = messageInput.value.split('\n').length;
  return Math.min(Math.max(lines, 3), 6);
});

// 计算聊天标题
const chatTitle = computed(() => {
  if (!currentChat.value) return '';
  return currentChat.value.name || 
         (chatType.value === 'friend' ? '未命名用户' : '未命名群组');
});

// 计算聊天头像（好友优先用好友头像，群聊优先用群store中的avatar）
const chatAvatar = computed(() => {
  if (!currentChat.value) return '';
  if (chatType.value === 'friend') {
    return friendInfo.value.avatar || '';
  } else {
    const group = gStore.allGroups.find(g => g.id === currentChat.value.id);
    return group?.avatar || currentChat.value.avatar || '';
  }
});

// 计算聊天首字母
const chatInitials = computed(() => {
  return getInitials(chatTitle.value);
});

// 模拟用户在线状态
const isUserOnline = computed(() => {
  // 这里应该根据实际的在线状态逻辑来实现
  // 暂时返回随机值模拟
  return Math.random() > 0.5;
});

// 过滤群成员
const filteredGroupMembers = computed(() => {
  if (!memberSearchKeyword.value) return groupMembers.value;
  
  const keyword = memberSearchKeyword.value.toLowerCase();
  return groupMembers.value.filter(member => {
    return (member.username && member.username.toLowerCase().includes(keyword)) || 
           (member.nickname && member.nickname.toLowerCase().includes(keyword));
  });
});

// 判断当前用户是否为管理员
const isCurrentUserAdmin = computed(() => {
  if (!currentChat.value || chatType.value !== 'group') return false;
  
  const group = gStore.allGroups.find(g => g.id === currentChat.value.id);
  if (!group) return false;
  
  // 群主肯定是管理员
  if (group.ownerId === currentUserId.value) return true;
  
  // 检查是否在管理员列表中
  return group.admins?.includes(currentUserId.value) || false;
});

// 获取当前聊天的好友信息
const friendInfo = computed(() => {
  if (!currentChat.value || chatType.value !== 'friend') return {};
  
  const friend = friendStore.friends.find(f => f.id === currentChat.value.id);
  return friend || {};
});

// 获取当前聊天的群组信息
const groupInfo = computed(() => {
  if (!currentChat.value || chatType.value !== 'group') return {};
  
  const group = gStore.allGroups.find(g => g.id === currentChat.value.id);
  return group || {};
});

// 获取当前群组的成员
const groupMembers = computed(() => {
  if (!currentChat.value || chatType.value !== 'group') return [];
  
  const group = gStore.allGroups.find(g => g.id === currentChat.value.id);
  return group?.members || [];
});

// 检查用户是否为群主
const isGroupOwner = (userId) => {
  return groupInfo.value?.ownerId === userId;
};

// 对话框标题
const chatInfoTitle = computed(() => {
  if (!currentChat.value) return '';
  
  return chatType.value === 'friend' ? '好友信息' : '群组信息';
});

// 监听消息变化，自动滚动到底部
watch(messages, () => {
  scrollToBottom();
}, { deep: true });

// 监听当前聊天变化
watch(currentChat, () => {
  messageInput.value = '';
  nextTick(scrollToBottom);
});

// 挂载后初始化
onMounted(() => {
  scrollToBottom();
});

// 自动滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
    }
  });
};

// 判断消息是否为当前用户发送
const isOwnMessage = (message) => {
  return message.senderId === currentUserId.value;
};

// 获取发送者头像
const getSenderAvatar = (message) => {
  if (isOwnMessage(message)) return userAvatar.value;
  
  if (chatType.value === 'friend') {
    return friendInfo.value.avatar;
  } else {
    const sender = groupMembers.value.find(member => member.id === message.senderId);
    return sender?.avatar || '';
  }
};

// 获取发送者首字母
const getSenderInitials = (message) => {
  if (isOwnMessage(message)) return userInitials.value;
  
  if (chatType.value === 'friend') {
    return getInitials(friendInfo.value.nickname || friendInfo.value.username);
  } else {
    const sender = groupMembers.value.find(member => member.id === message.senderId);
    return getInitials(sender?.nickname || sender?.username || '?');
  }
};

// 获取发送者名称（用于群聊）
const getSenderName = (message) => {
  if (isOwnMessage(message)) return '我';
  
  const sender = groupMembers.value.find(member => member.id === message.senderId);
  return sender?.nickname || sender?.username || '未知用户';
};

// 格式化日期
const formatDate = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    console.warn('无效的日期格式:', timestamp);
    return timestamp; // 返回原始值，防止显示'Invalid Date'
  }
  
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString();
  
  if (isToday) {
    return '今天';
  } else if (isYesterday) {
    return '昨天';
  } else if (date.getFullYear() === now.getFullYear()) {
    // 同一年内，显示月日和星期
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
  } else {
    // 不同年，显示完整日期
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }
};

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  
  // 处理日期时间格式
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    console.warn('无效的时间格式:', timestamp);
    return timestamp; // 返回原始值，防止显示'Invalid Date'
  }
  
  // 显示时和分
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 判断是否需要显示日期分隔符
const shouldShowDateDivider = (message, index) => {
  if (index === 0) return true;
  
  const currentDate = new Date(message.sendAt);
  const prevDate = new Date(messages.value[index - 1].sendAt);
  
  // 确保日期有效
  if (isNaN(currentDate.getTime()) || isNaN(prevDate.getTime())) {
    return false;
  }
  
  // 比较年月日是否相同
  return (
    currentDate.getFullYear() !== prevDate.getFullYear() ||
    currentDate.getMonth() !== prevDate.getMonth() ||
    currentDate.getDate() !== prevDate.getDate()
  );
};

// 判断是否是一组消息的第一条
const isFirstMessageOfGroup = (message, index) => {
  if (index === 0) return true;
  
  const prevMessage = messages.value[index - 1];
  
  // 不同发送者或时间间隔超过2分钟视为新的一组
  if (prevMessage.senderId !== message.senderId) return true;
  
  const currentTime = new Date(message.sendAt).getTime();
  const prevTime = new Date(prevMessage.sendAt).getTime();
  const timeDiff = currentTime - prevTime;
  
  return timeDiff > 2 * 60 * 1000; // 2分钟
};

// 判断是否是一组消息的最后一条
const isLastMessageOfGroup = (message, index) => {
  if (index === messages.value.length - 1) return true;
  
  const nextMessage = messages.value[index + 1];
  
  // 不同发送者或时间间隔超过2分钟视为新的一组
  if (nextMessage.senderId !== message.senderId) return true;
  
  const currentTime = new Date(message.sendAt).getTime();
  const nextTime = new Date(nextMessage.sendAt).getTime();
  const timeDiff = nextTime - currentTime;
  
  return timeDiff > 2 * 60 * 1000; // 2分钟
};

// 检查是否为群管理员
const isGroupAdmin = (userId) => {
  if (!groupInfo.value) return false;
  return groupInfo.value.admins?.includes(userId) || false;
};

// 判断是否可以移除成员
const canRemoveMember = (memberId) => {
  // 群主可以移除任何人，管理员只能移除普通成员
  if (isGroupOwner(currentUserId.value)) {
    return memberId !== currentUserId.value;
  } else if (isGroupAdmin(currentUserId.value)) {
    return !isGroupOwner(memberId) && !isGroupAdmin(memberId) && memberId !== currentUserId.value;
  }
  return false;
};

// 从文件URL中获取文件名
const getFileName = (fileUrl) => {
  if (!fileUrl) return '未知文件';
  
  try {
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    return decodeURIComponent(pathParts[pathParts.length - 1]);
  } catch (e) {
    const parts = fileUrl.split('/');
    return parts[parts.length - 1];
  }
};

// 下载文件
const downloadFile = (fileUrl) => {
  if (!fileUrl) {
    ElMessage.error('文件链接无效');
    return;
  }
  
  window.open(fileUrl, '_blank');
};

// 触发图片上传
const triggerImageUpload = () => {
  imageInputRef.value.click();
};

// 触发文件上传
const triggerFileUpload = () => {
  fileInputRef.value.click();
};

// 处理图片上传
const handleImageUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  // 这里应该实现图片上传逻辑，然后获取图片URL
  // 暂时先使用假URL
  const imageUrl = URL.createObjectURL(file);
  
  ElMessage.warning('图片上传功能尚未完全实现，暂不支持图片发送');
  
  // 重置文件输入
  event.target.value = '';
};

// 处理文件上传
const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  // 这里应该实现文件上传逻辑，然后获取文件URL
  // 暂时先使用假URL
  const fileUrl = URL.createObjectURL(file);
  
  ElMessage.warning('文件上传功能尚未完全实现，暂不支持文件发送');
  
  // 重置文件输入
  event.target.value = '';
};

// 插入表情
const insertEmoji = (emoji) => {
  if (!messageInputRef.value) return;
  
  const textarea = messageInputRef.value.$el.querySelector('textarea');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = messageInput.value;
  
  messageInput.value = text.substring(0, start) + emoji + text.substring(end);
  
  // 重新设置光标位置
  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    textarea.focus();
  });
};

// 处理Shift+Enter键
const handleShiftEnter = () => {
  messageInput.value += '\n';
};

// 发送消息
const sendMessage = async () => {
  if (!messageInput.value.trim() || !currentChat.value) return;
  
  // 模拟消息状态
  const tempId = `temp-${Date.now()}`;
  const tempMessage = {
    id: tempId,
    content: messageInput.value,
    senderId: currentUserId.value,
    sendAt: new Date().toISOString(),
    messageType: 'TEXT',
    status: 'sending'
  };
  
  // 添加临时消息到列表
  msgStore.addTempMessage(tempMessage);
  
  // 清空输入框
  const content = messageInput.value;
  messageInput.value = '';
  scrollToBottom();
  
  // 构建消息数据
  const messageData = {
    content: content,
    messageType: 'TEXT'
  };
  
  if (chatType.value === 'friend') {
    messageData.receiverId = currentChat.value.id;
  } else {
    messageData.groupId = currentChat.value.id;
  }
  
  try {
    const success = await msgStore.sendMessage(messageData);
    
    if (success) {
      // 更新临时消息状态为已发送
      msgStore.updateTempMessageStatus(tempId, 'sent');
      
      // 模拟消息已送达效果
      setTimeout(() => {
        msgStore.updateTempMessageStatus(tempId, 'delivered');
        
        // 模拟已读效果
        setTimeout(() => {
          msgStore.updateTempMessageStatus(tempId, 'read');
        }, 3000);
      }, 1500);
    } else {
      // 更新临时消息状态为发送失败
      msgStore.updateTempMessageStatus(tempId, 'failed');
      ElMessage.error('消息发送失败');
    }
  } catch (error) {
    // 更新临时消息状态为发送失败
    msgStore.updateTempMessageStatus(tempId, 'failed');
    console.error('发送消息出错:', error);
    ElMessage.error('消息发送出错');
  }
};

// 显示聊天信息
const showChatInfo = () => {
  chatInfoDialogVisible.value = true;
};

// 退出群组
const leaveGroup = () => {
  ElMessageBox.confirm(
    '确定要退出该群组吗？',
    '退出群组',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    ElMessage.info('退出群组功能尚未实现');
    // TODO: 实现退出群组功能
  }).catch(() => {});
};

// 获取姓名首字母
const getInitials = (name) => {
  if (!name) return '?';
  return name.substring(0, 2).toUpperCase();
};
</script>

<style scoped>
/* 基础布局 */
.chat-window {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color);
  position: relative;
}

.chat-window-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* 聊天标题 */
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  z-index: 10;
}

.chat-title {
  flex: 1;
  display: flex;
  align-items: center;
}

.title-container {
  display: flex;
  align-items: center;
}

.chat-avatar {
  margin-right: 12px;
  border: 2px solid transparent;
}

.title-info {
  display: flex;
  flex-direction: column;
}

.title-info h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.2;
}

.chat-subtitle, .chat-status {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.chat-status {
  display: flex;
  align-items: center;
}

.chat-status::before {
  content: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--el-text-color-disabled);
  margin-right: 4px;
}

.chat-status.online::before {
  background-color: #10b981;
}

.chat-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.action-icon, .more-icon {
  font-size: 20px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-icon:hover, .more-icon:hover {
  color: var(--el-color-primary);
  transform: scale(1.05);
}

/* 聊天消息列表 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background-color: var(--el-bg-color-page);
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.1) transparent;
}

.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.2);
}

.message-container {
  margin-bottom: 2px;
  position: relative;
  max-width: 100%;
  transition: all 0.2s ease;
}

.message-container.first-of-group {
  margin-top: 8px;
}

.message-container.last-of-group {
  margin-bottom: 8px;
}

.date-divider {
  text-align: center;
  margin: 24px 0 16px;
  position: relative;
}

.date-line {
  display: flex;
  align-items: center;
  justify-content: center;
}

.date-line::before,
.date-line::after {
  content: "";
  flex: 1;
  height: 1px;
  background-color: var(--el-border-color-light);
  margin: 0 16px;
}

.date-text {
  background-color: var(--el-bg-color-page);
  padding: 0 10px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 500;
  border-radius: 10px;
}

.message-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 0 12px;
}

/* 自己的消息：内容区右对齐 */
.own-message .message-wrapper {
  justify-content: flex-end;
}

.message-avatar {
  flex-shrink: 0;
  transition: all 0.2s ease;
  margin-top: 0;
}

.message-avatar.left-avatar {
  order: 1;
}

.message-avatar.right-avatar {
  order: 3;
}

/* 隐藏头像但保留空间 */
.message-avatar.invisible-avatar {
  visibility: hidden;
}

.message-content {
  flex: 0 1 auto;
  max-width: calc(100% - 60px);
  display: flex;
  flex-direction: column;
  min-width: 0;
  order: 2;
}

.own-message .message-content {
  align-items: flex-end;
}

.message-sender {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
  padding: 0 8px;
}

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  position: relative;
}

.message-bubble {
  padding: 9px 12px;
  border-radius: 4px;
  background-color: #ffffff;
  position: relative;
  display: inline-block;
  max-width: 100%;
  word-break: break-word;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

/* 自己的消息气泡 - QQ蓝色 */
.own-message .message-bubble {
  background: linear-gradient(135deg, #a6c1ee 0%, #b3d4fc 100%);
  color: #000000;
}

.message-bubble:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.text-message {
  white-space: pre-wrap;
  line-height: 1.5;
  font-size: 14px;
}

/* 图片消息 */
.message-type-image .message-bubble {
  padding: 4px;
  background-color: transparent;
  box-shadow: none;
}

.own-message .message-type-image .message-bubble {
  background: transparent;
}

.image-message {
  max-width: 240px;
  max-height: 320px;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.message-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.message-image:hover {
  transform: scale(1.02);
}

.image-loading, .image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 160px;
  height: 160px;
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 13px;
  border-radius: 4px;
}

.image-loading .el-icon, .image-error .el-icon {
  font-size: 32px;
  margin-bottom: 12px;
  color: var(--el-text-color-placeholder);
}

/* 文件消息 */
.message-type-file .message-bubble {
  padding: 10px;
  min-width: 220px;
}

.own-message .message-type-file .message-bubble {
  background: linear-gradient(135deg, #a6c1ee 0%, #b3d4fc 100%);
}

.file-message {
  display: flex;
  align-items: center;
}

.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background-color: var(--el-color-primary-light-9);
  border-radius: 6px;
  margin-right: 12px;
  flex-shrink: 0;
}

.own-message .file-icon {
  background-color: rgba(255, 255, 255, 0.3);
}

.file-icon .el-icon {
  font-size: 20px;
  color: var(--el-color-primary);
}

.own-message .file-icon .el-icon {
  color: #1e3a8a;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
}

.file-actions {
  display: flex;
  justify-content: flex-end;
}

/* 消息元数据 - hover时显示 */
.message-meta {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  opacity: 0;
  transition: opacity 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
  gap: 4px;
}

.message-container:hover .message-meta {
  opacity: 1;
}

.message-time {
  order: 2;
}

.message-status {
  display: flex;
  align-items: center;
  order: 1;
}

.status-icon {
  font-size: 14px;
  margin-left: 2px;
}

.status-delivered {
  color: var(--el-color-info);
}

.status-read {
  color: var(--el-color-primary);
}

.status-failed {
  color: var(--el-color-danger);
}

/* 消息输入框 */
.chat-input {
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);
  z-index: 5;
}

.input-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.toolbar-icon {
  font-size: 18px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.emoji-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.toolbar-icon:hover {
  color: var(--el-color-primary);
  transform: scale(1.1);
}

/* 表情选择器 */
.emoji-picker {
  display: grid;
  grid-template-columns: repeat(8, 32px);
  gap: 8px;
  padding: 8px;
  justify-content: start;
  box-sizing: border-box;
  width: 100%;
}

.emoji-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 20px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.emoji-item:hover {
  background-color: var(--el-fill-color-light);
  transform: scale(1.1);
}

/* 输入区域 */
.input-container {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.textarea-wrapper {
  flex: 1;
  display: flex;
  position: relative;
  border-radius: 24px;
  transition: all 0.3s ease;
  background-color: var(--el-fill-color-light);
  padding: 0 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  height: 48px;
  align-items: center;
}

.textarea-wrapper.focused {
  background-color: var(--el-bg-color);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
}

.message-textarea {
  flex: 1;
}

.message-textarea :deep(.el-textarea__inner) {
  border: none;
  background: transparent;
  padding: 0;
  font-size: 15px;
  resize: none;
  height: 48px;
  line-height: 48px;
  max-height: 48px;
  min-height: 48px;
  box-shadow: none !important;
  overflow: hidden;
}

.input-actions {
  display: flex;
  align-items: center;
  padding-bottom: 0;
}

.send-button {
  font-size: 15px;
  height: 48px;
  padding: 0 24px;
  border-radius: 24px;
  transition: all 0.3s ease;
}

.send-button:hover:not(:disabled) {
  transform: scale(1.05);
}

/* 空聊天状态 */
.empty-chat {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--el-text-color-secondary);
  padding: 24px;
}

.empty-illustration {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.empty-icon {
  font-size: 64px;
  color: var(--el-color-primary-light-7);
  margin-bottom: 16px;
}

.empty-hint {
  color: var(--el-text-color-secondary);
  font-size: 16px;
}

.empty-messages {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 聊天信息样式 */
.chat-info-dialog :deep(.el-dialog__header) {
  padding: 20px;
  border-bottom: 1px solid var(--el-border-color-light);
  margin-right: 0;
}

.chat-info-container {
  padding: 0;
  max-height: 70vh;
  overflow-y: auto;
}

.chat-info-profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  position: relative;
  background: linear-gradient(to bottom, var(--el-color-primary-light-9), var(--el-bg-color));
  border-radius: 0 0 50% 50% / 20px;
}

.profile-avatar {
  border: 4px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.profile-status {
  position: absolute;
  bottom: 64px;
  right: calc(50% - 50px);
  width: 14px;
  height: 14px;
  background-color: var(--el-text-color-disabled);
  border-radius: 50%;
  border: 2px solid white;
}

.profile-status.online {
  background-color: #10b981;
}

.chat-info-profile h2 {
  margin: 16px 0 4px;
  font-size: 24px;
  font-weight: 600;
}

.profile-username {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.group-id {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.group-description {
  margin: 12px 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
  text-align: center;
  max-width: 80%;
}

.chat-info-dialog :deep(.el-tabs) {
  --el-tabs-header-height: 50px;
}

.chat-info-dialog :deep(.el-tabs__nav-wrap) {
  padding: 0 20px;
}

.info-section {
  padding: 20px;
}

.info-item {
  margin-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  padding-bottom: 16px;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  display: block;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.info-value {
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.action-buttons {
  display: flex;
  justify-content: space-around;
  padding: 0 20px 20px;
  gap: 16px;
}

.group-stats {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-top: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-item .el-icon {
  font-size: 16px;
  color: var(--el-color-primary);
}

.members-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.members-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.member-search {
  width: 200px;
}

.members-list {
  max-height: 300px;
  overflow-y: auto;
  padding: 0 20px;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}

.member-item:last-child {
  border-bottom: none;
}

.member-avatar {
  flex-shrink: 0;
}

.member-info {
  flex: 1;
  margin-left: 16px;
  min-width: 0;
}

.member-name {
  display: flex;
  align-items: center;
  font-weight: 500;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role-tag {
  flex-shrink: 0;
}

.member-status {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.member-status.online {
  color: #10b981;
}

.member-actions {
  margin-left: 16px;
}

.media-section {
  padding: 20px;
  text-align: center;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
}

.media-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--el-text-color-secondary);
  padding: 40px 0;
}

.media-empty .el-icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: var(--el-text-color-placeholder);
}

.group-settings {
  padding: 20px;
}

.settings-section {
  margin-bottom: 32px;
}

.settings-section h4 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.danger-zone {
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-light);
}

.danger-zone h4 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 500;
  color: var(--el-color-danger);
}

/* 动画效果 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .message-content {
    max-width: calc(100% - 60px);
  }
  
  .image-message {
    max-width: 200px;
    max-height: 280px;
  }
  
  .file-name {
    max-width: 120px;
  }
  
  .chat-header {
    padding: 10px 12px;
  }
  
  .chat-input {
    padding: 10px 12px;
  }
  
  .emoji-picker {
    grid-template-columns: repeat(6, 1fr);
  }
  
  .message-wrapper {
    padding: 0 8px;
  }
}

/* 暗黑模式调整 */
:deep(.dark-mode) .chat-header {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

:deep(.dark-mode) .message-bubble {
  background-color: #2d2d2d;
  color: #e5e5e5;
}

:deep(.dark-mode) .own-message .message-bubble {
  background: linear-gradient(135deg, #4a7ab8 0%, #5a8fd8 100%);
  color: #ffffff;
}

:deep(.dark-mode) .textarea-wrapper {
  background-color: #383838;
}

:deep(.dark-mode) .textarea-wrapper.focused {
  background-color: #404040;
}

:deep(.dark-mode) .own-message .file-icon {
  background-color: rgba(255, 255, 255, 0.15);
}

:deep(.dark-mode) .own-message .file-icon .el-icon {
  color: #bfdbfe;
}
</style>