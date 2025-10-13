<template>
  <el-dialog
    v-model="visible"
    title="好友信息"
    width="480px"
    :append-to-body="true"
    destroy-on-close
    @close="handleClose"
  >
    <div v-if="friendInfo" class="friend-info-container">
      <!-- 好友头像和基本信息 -->
      <div class="friend-profile">
        <el-avatar :size="100" :src="friendInfo.avatar" class="profile-avatar">
          {{ getInitials(friendInfo.username) }}
        </el-avatar>
        <div class="profile-status" :class="{ 'online': isOnline }"></div>
        <h2>{{ friendInfo.username }}</h2>
        <p v-if="friendInfo.signature" class="profile-signature">
          {{ friendInfo.signature }}
        </p>
        <div class="online-status" :class="{ 'online': isOnline }">
          {{ isOnline ? '在线' : '离线' }}
        </div>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="基本信息" name="basic">
          <div class="info-section">
            <div class="info-item">
              <span class="info-label">用户名</span>
              <span class="info-value">{{ friendInfo.username }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">个性签名</span>
              <span class="info-value">{{ friendInfo.signature || '这个人很懒，什么都没写' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">成为好友</span>
              <span class="info-value">{{ formatDate(friendInfo.createdAt) }}</span>
            </div>
          </div>

          <div class="action-buttons">
            <el-button type="primary" icon="ChatDotRound" @click="startChat">
              发送消息
            </el-button>
            <el-button type="danger" plain icon="Delete" @click="confirmDelete">
              删除好友
            </el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="聊天记录" name="messages">
          <div class="messages-section">
            <div class="messages-header">
              <el-input
                v-model="messageSearchKeyword"
                placeholder="搜索聊天记录"
                prefix-icon="Search"
                clearable
                size="small"
              />
            </div>

            <div class="messages-list" v-loading="loadingMessages">
              <template v-if="filteredMessages.length > 0">
                <div
                  v-for="message in filteredMessages"
                  :key="message.id"
                  class="message-item"
                  @click="locateMessage(message)"
                >
                  <div class="message-header">
                    <span class="message-sender">
                      {{ isOwnMessage(message) ? '我' : friendInfo.username }}
                    </span>
                    <span class="message-time">{{ formatDateTime(message.sendAt) }}</span>
                  </div>
                  <div class="message-content">
                    <template v-if="message.messageType === 'TEXT'">
                      {{ message.content }}
                    </template>
                    <template v-else-if="message.messageType === 'IMAGE'">
                      <el-icon><Picture /></el-icon> [图片]
                    </template>
                    <template v-else-if="message.messageType === 'FILE'">
                      <el-icon><Document /></el-icon> [文件]
                    </template>
                  </div>
                </div>
              </template>
              <el-empty v-else description="暂无聊天记录" />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="共享文件" name="media">
          <div class="media-section">
            <div class="media-filter">
              <el-radio-group v-model="mediaFilter" size="small">
                <el-radio-button label="all">全部</el-radio-button>
                <el-radio-button label="image">图片</el-radio-button>
                <el-radio-button label="file">文件</el-radio-button>
              </el-radio-group>
            </div>

            <div class="media-list" v-loading="loadingMedia">
              <template v-if="filteredMedia.length > 0">
                <div
                  v-for="item in filteredMedia"
                  :key="item.id"
                  class="media-item"
                  @click="viewMedia(item)"
                >
                  <template v-if="item.messageType === 'IMAGE'">
                    <el-image
                      :src="item.content"
                      fit="cover"
                      class="media-image"
                      :preview-src-list="imagePreviewList"
                    >
                      <template #error>
                        <div class="image-error">
                          <el-icon><Picture /></el-icon>
                        </div>
                      </template>
                    </el-image>
                  </template>
                  <template v-else-if="item.messageType === 'FILE'">
                    <div class="file-item">
                      <el-icon class="file-icon"><Document /></el-icon>
                      <div class="file-info">
                        <div class="file-name">{{ getFileName(item.content) }}</div>
                        <div class="file-date">{{ formatDate(item.sendAt) }}</div>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
              <el-empty v-else description="暂无共享文件" />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ChatDotRound, Delete, Picture, Document, Search } from '@element-plus/icons-vue';
import { friendshipStore } from '@/store/friendship';
import { messageStore } from '@/store/message';
import { useUserInfoStore } from '@/store/userInfo';

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  friendId: {
    type: [String, Number],
    required: false,
    default: null
  }
});

// Emits
const emit = defineEmits(['update:modelValue', 'close', 'startChat', 'delete']);

// Store
const friendStore = friendshipStore();
const msgStore = messageStore();
const userInfoStore = useUserInfoStore();

// 响应式数据
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const activeTab = ref('basic');
const messageSearchKeyword = ref('');
const mediaFilter = ref('all');
const loadingMessages = ref(false);
const loadingMedia = ref(false);

// 好友信息
const friendInfo = computed(() => {
  return friendStore.friends.find(f => f.id === props.friendId);
});

// 模拟在线状态
const isOnline = computed(() => {
  // TODO: 实现真实的在线状态
  return Math.random() > 0.5;
});

// 聊天记录
const messages = computed(() => {
  if (!props.friendId) return [];
  
  return msgStore.messages.filter(msg => {
    // 过滤出与该好友的所有消息（不包含群组消息）
    return !msg.groupId && (
      (msg.senderId === props.friendId || msg.receiverId === props.friendId)
    );
  }).sort((a, b) => {
    const timeA = new Date(a.sendAt).getTime();
    const timeB = new Date(b.sendAt).getTime();
    return timeA - timeB;
  });
});

// 过滤后的消息
const filteredMessages = computed(() => {
  if (!messageSearchKeyword.value) return messages.value;
  
  const keyword = messageSearchKeyword.value.toLowerCase();
  return messages.value.filter(msg => {
    if (msg.messageType === 'TEXT') {
      return msg.content.toLowerCase().includes(keyword);
    }
    return false;
  });
});

// 媒体文件
const mediaMessages = computed(() => {
  return messages.value.filter(msg => 
    msg.messageType === 'IMAGE' || msg.messageType === 'FILE'
  );
});

// 过滤后的媒体文件
const filteredMedia = computed(() => {
  if (mediaFilter.value === 'all') return mediaMessages.value;
  if (mediaFilter.value === 'image') {
    return mediaMessages.value.filter(msg => msg.messageType === 'IMAGE');
  }
  if (mediaFilter.value === 'file') {
    return mediaMessages.value.filter(msg => msg.messageType === 'FILE');
  }
  return mediaMessages.value;
});

// 图片预览列表
const imagePreviewList = computed(() => {
  return mediaMessages.value
    .filter(msg => msg.messageType === 'IMAGE')
    .map(msg => msg.content);
});

// 方法
const getInitials = (name) => {
  if (!name) return '?';
  return name.substring(0, 2).toUpperCase();
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatDateTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const isOwnMessage = (message) => {
  return message.senderId === userInfoStore.userId;
};

const getFileName = (url) => {
  if (!url) return '未知文件';
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    return decodeURIComponent(pathParts[pathParts.length - 1]);
  } catch (e) {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }
};

const handleClose = () => {
  emit('close');
};

const startChat = () => {
  emit('startChat', friendInfo.value);
  visible.value = false;
};

const confirmDelete = () => {
  ElMessageBox.confirm(
    `确定要删除好友 ${friendInfo.value.username} 吗？`,
    '删除好友',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    emit('delete', props.friendId);
    visible.value = false;
  }).catch(() => {});
};

const locateMessage = (message) => {
  ElMessage.info('定位到消息功能开发中...');
  // TODO: 实现跳转到指定消息
};

const viewMedia = (item) => {
  if (item.messageType === 'FILE') {
    window.open(item.content, '_blank');
  }
};

// 监听对话框打开，加载数据
watch(visible, (newVal) => {
  if (newVal && props.friendId) {
    // 可以在这里加载更多数据
    activeTab.value = 'basic';
    messageSearchKeyword.value = '';
    mediaFilter.value = 'all';
  }
});
</script>

<style scoped>
.friend-info-container {
  padding: 0;
}

.friend-profile {
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
  margin-bottom: 16px;
}

.profile-status {
  position: absolute;
  top: 88px;
  left: calc(50% + 28px);
  width: 14px;
  height: 14px;
  background-color: var(--el-text-color-disabled);
  border-radius: 50%;
  border: 2px solid white;
}

.profile-status.online {
  background-color: #10b981;
}

.friend-profile h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.profile-signature {
  margin: 8px 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  font-style: italic;
  text-align: center;
  max-width: 80%;
}

.online-status {
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 12px;
  background-color: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.online-status.online {
  background-color: #10b98120;
  color: #10b981;
}

.info-section {
  padding: 20px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.info-value {
  font-size: 14px;
  color: var(--el-text-color-primary);
  text-align: right;
  max-width: 60%;
  word-break: break-word;
}

.action-buttons {
  display: flex;
  gap: 12px;
  padding: 0 20px 20px;
}

.action-buttons .el-button {
  flex: 1;
}

.messages-section {
  padding: 20px;
}

.messages-header {
  margin-bottom: 16px;
}

.messages-list {
  max-height: 400px;
  overflow-y: auto;
}

.message-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 8px;
  background-color: var(--el-fill-color-light);
}

.message-item:hover {
  background-color: var(--el-fill-color);
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.message-sender {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.message-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.message-content {
  font-size: 14px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 4px;
}

.media-section {
  padding: 20px;
}

.media-filter {
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}

.media-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.media-item {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s;
}

.media-item:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.media-image {
  width: 100%;
  height: 100px;
  border-radius: 8px;
}

.image-error {
  width: 100%;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-placeholder);
}

.image-error .el-icon {
  font-size: 32px;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 8px;
  gap: 12px;
}

.file-icon {
  font-size: 24px;
  color: var(--el-color-primary);
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.file-date {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
