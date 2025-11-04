<script setup>
import { ref, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  UserFilled, Calendar, More, ChatDotRound, Star, Close, Delete,
  RemoveFilled, Picture, Document, Search, Upload
} from '@element-plus/icons-vue';
import { groupStore } from '@/store/group';
import { messageStore } from '@/store/message';
import { conversationStore } from '@/store/conversation';
import { onlineStatusStore } from '@/store/onlineStatus';
import { useUserInfoStore } from '@/store/userInfo';
import { updateGroupInfoService } from '@/api/group';
import { getUserInfoService } from '@/api/user';
import { ossClient } from '@/util/oss';
import ImageViewer from './ImageViewer.vue';

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  groupId: {
    type: [String, Number],
    required: false,
    default: null
  }
});

// Emits
const emit = defineEmits(['update:modelValue', 'close', 'sendMessage', 'leave']);

// Store
const gStore = groupStore();
const msgStore = messageStore();
const convStore = conversationStore();
const onlineStore = onlineStatusStore();
const userInfoStore = useUserInfoStore();

// 响应式数据
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const activeTab = ref('members');
const memberSearchKeyword = ref('');
const messageSearchKeyword = ref('');
const mediaFilter = ref('all');
const loadingMessages = ref(false);
const loadingMedia = ref(false);
const updatingGroup = ref(false);
const uploadingAvatar = ref(false);

// 图片查看器
const imageViewerVisible = ref(false);
const currentImageList = ref([]);
const currentImageIndex = ref(0);

const editGroupFormRef = ref(null);
const editForm = ref({
  name: '',
  description: '',
  avatar: ''
});

const editGroupRules = {
  name: [
    { required: true, message: '请输入群组名称', trigger: 'blur' },
    { min: 1, max: 20, message: '长度在 1 到 20 个字符', trigger: 'blur' }
  ],
  description: [
    { max: 100, message: '最多100个字符', trigger: 'blur' }
  ]
};

// 当前用户ID
const currentUserId = computed(() => userInfoStore.userId);

// 群组信息
const groupInfo = computed(() => {
  return gStore.allGroups.find(g => g.id === props.groupId);
});
// 群组成员
const groupMembers = computed(() => {
  return groupInfo.value?.members || [];
});

// 过滤后的成员
const filteredMembers = computed(() => {
  if (!memberSearchKeyword.value) return groupMembers.value;
  
  const keyword = memberSearchKeyword.value.toLowerCase();
  return groupMembers.value.filter(member => {
    return (member.username && member.username.toLowerCase().includes(keyword));
  });
});

// 聊天记录
const messages = computed(() => {
  if (!props.groupId) return [];
  
  return msgStore.messages.filter(msg => {
    // 过滤出该群组的所有消息
    return msg.groupId === props.groupId;
  }).sort((a, b) => {
    const timeA = new Date(a.sentAt).getTime();
    const timeB = new Date(b.sentAt).getTime();
    return timeB - timeA;
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

// 判断当前用户是否为管理员
const isCurrentUserAdmin = computed(() => {
  if (!groupInfo.value) return false;
  
  // 群主肯定是管理员
  if (groupInfo.value.ownerId === currentUserId.value) return true;
  
  // 检查是否在管理员列表中
  return groupInfo.value.adminIds?.includes(currentUserId.value) || false;
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

const formatJoinTime = (date) => {
  if (!date) return '';
  const joinDate = new Date(date);
  const now = new Date();
  const diffTime = now - joinDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return '今天';
  } else if (diffDays === 1) {
    return '昨天';
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}周前`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months}个月前`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years}年前`;
  }
};

const isGroupOwner = (userId) => {
  return groupInfo.value?.ownerId === userId;
};

const isGroupAdmin = (userId) => {
  return groupInfo.value?.adminIds?.includes(userId) || false;
};

const isUserOnline = (userId) => {
  // 自己始终显示为在线
  if (userId === currentUserId.value) {
    return true;
  }
  return onlineStore.isUserOnline(userId);
};

// 正在获取用户信息的 ID 集合（防止重复请求）
const fetchingUserIds = new Set();

// 异步获取用户信息（如果缓存中没有则从 API 获取）
const fetchUserInfoIfNeeded = async (userId) => {
  // 如果缓存中已有，直接返回
  if (msgStore.userInfoCache[userId]) {
    return msgStore.userInfoCache[userId];
  }
  
  // 如果是当前用户自己，不需要获取
  if (userId === currentUserId.value) {
    return null;
  }
  
  // 如果正在获取中，避免重复请求
  if (fetchingUserIds.has(userId)) {
    return null;
  }
  
  // 标记为正在获取
  fetchingUserIds.add(userId);
  
  // 从 API 获取用户信息
  try {
    const userInfo = await getUserInfoService({ id: userId });
    if (userInfo) {
      // 存入缓存
      msgStore.userInfoCache[userId] = {
        username: userInfo.username,
        avatar: userInfo.avatar || '',
        signature: userInfo.signature || ''
      };
      return msgStore.userInfoCache[userId];
    }
  } catch (error) {
    console.error(`获取用户 ${userId} 信息失败:`, error);
  } finally {
    // 移除正在获取的标记
    fetchingUserIds.delete(userId);
  }
  
  return null;
};

const getSenderName = (message) => {
  if (message.senderId === currentUserId.value) return '我';
  
  // 先尝试从群组成员中查找
  const sender = groupMembers.value.find(m => m.id === message.senderId);
  if (sender?.username) {
    return sender.username;
  }
  
  // 如果找不到，从缓存中查找（用于已退群的用户）
  const cachedInfo = msgStore.userInfoCache[message.senderId];
  if (!cachedInfo) {
    // 缓存中没有，异步获取（不阻塞渲染）
    fetchUserInfoIfNeeded(message.senderId);
    return '加载中...'; // 暂时返回加载中，等待异步获取完成后会自动更新
  }
  
  return cachedInfo.username || '未知用户';
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

// 权限判断
const canManageMember = (memberId) => {
  // 不能操作自己
  if (memberId === currentUserId.value) return false;
  // 只有管理员可以操作
  return isCurrentUserAdmin.value;
};

const canSetAdmin = (memberId) => {
  // 只有群主可以设置管理员，且目标不是已有的管理员
  return isGroupOwner(currentUserId.value) && 
         !isGroupOwner(memberId) && 
         !isGroupAdmin(memberId);
};

const canRemoveAdmin = (memberId) => {
  // 只有群主可以取消管理员
  return isGroupOwner(currentUserId.value) && isGroupAdmin(memberId);
};

const canRemoveMember = (memberId) => {
  // 群主可以移除任何人（除了自己），管理员只能移除普通成员
  if (memberId === currentUserId.value) return false;
  
  if (isGroupOwner(currentUserId.value)) {
    return true;
  } else if (isGroupAdmin(currentUserId.value)) {
    return !isGroupOwner(memberId) && !isGroupAdmin(memberId);
  }
  return false;
};

// 操作方法
const handleClose = () => {
  emit('close');
};

const sendPrivateMessage = (member) => {
  emit('sendMessage', member);
  visible.value = false;
};

const setAsAdmin = (memberId) => {
  ElMessageBox.confirm(
    '确定要将该成员设为管理员吗？',
    '设置管理员',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info',
    }
  ).then(() => {
    ElMessage.info('设置管理员功能开发中...');
    // TODO: 调用API设置管理员
  }).catch(() => {});
};

const removeAdmin = (memberId) => {
  ElMessageBox.confirm(
    '确定要取消该成员的管理员身份吗？',
    '取消管理员',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    ElMessage.info('取消管理员功能开发中...');
    // TODO: 调用API取消管理员
  }).catch(() => {});
};

const confirmRemoveMember = (member) => {
  ElMessageBox.confirm(
    `确定要将 ${member.username} 移出群组吗？`,
    '移出成员',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    ElMessage.info('移出成员功能开发中...');
    // TODO: 调用API移出成员
  }).catch(() => {});
};

const locateMessage = (message) => {
  ElMessage.info('定位到消息功能开发中...');
  // TODO: 实现跳转到指定消息
};

const viewMedia = (item) => {
  if (item.messageType === 'FILE') {
    window.open(item.content, '_blank');
  } else if (item.messageType === 'IMAGE') {
    openImageViewer(item.content);
  }
};

// 打开图片查看器
const openImageViewer = (imageUrl) => {
  // 收集所有图片消息的URL
  const imageMessages = mediaMessages.value.filter(msg => msg.messageType === 'IMAGE');
  currentImageList.value = imageMessages.map(msg => msg.content);
  
  // 找到当前图片的索引
  currentImageIndex.value = currentImageList.value.findIndex(url => url === imageUrl);
  if (currentImageIndex.value === -1) {
    currentImageIndex.value = 0;
  }
  
  imageViewerVisible.value = true;
};

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
    editForm.value.avatar = avatarUrl;
    
    ElMessage.success('头像上传成功');
  } catch (error) {
    console.error('头像上传失败:', error);
    ElMessage.error('头像上传失败');
  } finally {
    uploadingAvatar.value = false;
  }
};

const saveGroupSettings = async () => {
  if (!editGroupFormRef.value) return;
  
  try {
    await editGroupFormRef.value.validate();
    
    updatingGroup.value = true;
    
    // 构建更新数据对象
    const updateData = {
      id: props.groupId
    };
    
    // 只添加修改过的字段
    if (editForm.value.name !== groupInfo.value.name) {
      updateData.name = editForm.value.name;
    }
    if (editForm.value.description !== groupInfo.value.description) {
      updateData.description = editForm.value.description;
    }
    if (editForm.value.avatar && editForm.value.avatar !== groupInfo.value.avatar) {
      updateData.avatar = editForm.value.avatar;
    }
    
    // 如果没有任何修改，直接返回
    if (Object.keys(updateData).length === 1) {
      ElMessage.info('没有修改任何内容');
      updatingGroup.value = false;
      return;
    }
    
    // 调用 store 方法更新群组信息
    await gStore.updateGroupInfo(updateData);
    
    ElMessage.success('保存成功');
    
  } catch (error) {
    console.error('保存群组设置失败:', error);
    ElMessage.error('保存失败');
  } finally {
    updatingGroup.value = false;
  }
};

const confirmLeaveGroup = async () => {
  // 如果是群主，执行解散逻辑
  if (isGroupOwner(currentUserId.value)) {
    return confirmDismissGroup();
  }
  
  // 普通成员执行退出逻辑
  try {
    await ElMessageBox.confirm(
      '确定要退出该群组吗？退出后将无法接收群消息。',
      '退出群组',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    
    // 调用 store 方法退出群组
    const success = await gStore.leaveGroup(props.groupId);
    
    if (success) {
      // 删除本地会话
      convStore.deleteConversation(props.groupId, 'group', true);
      
      // 关闭对话框
      visible.value = false;
      
      // 触发 leave 事件，让父组件处理（例如切换到其他聊天）
      emit('leave', props.groupId);
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('退出群组失败:', error);
    }
  }
};

const confirmDismissGroup = async () => {
  try {
    await ElMessageBox.confirm(
      '解散群组后将无法恢复，确定要解散该群组吗？',
      '解散群组',
      {
        confirmButtonText: '确定解散',
        cancelButtonText: '取消',
        type: 'error',
        confirmButtonClass: 'el-button--danger'
      }
    );
    
    // 调用 store 方法解散群组
    const success = await gStore.deleteGroup(props.groupId);
    
    if (success) {
      // 删除本地会话
      convStore.deleteConversation(props.groupId, 'group', true);
      
      // 关闭对话框
      visible.value = false;
      
      // 触发 leave 事件，让父组件处理（例如切换到其他聊天）
      emit('leave', props.groupId);
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('解散群组失败:', error);
    }
  }
};

// 监听对话框打开
watch(visible, (newVal) => {
  if (newVal && props.groupId) {
    activeTab.value = 'members';
    memberSearchKeyword.value = '';
    messageSearchKeyword.value = '';
    mediaFilter.value = 'all';
    if (groupInfo.value) {
      editForm.value.name = groupInfo.value.name;
      editForm.value.description = groupInfo.value.description || '';
      editForm.value.avatar = groupInfo.value.avatar || '';
    }
  }
});
</script>

<template>
  <el-dialog
    v-model="visible"
    title="群组信息"
    width="520px"
    :append-to-body="true"
    destroy-on-close
    @close="handleClose"
  >
    <div v-if="groupInfo" class="group-info-container">
      <!-- 群组头像和基本信息 -->
      <div class="group-profile">
        <el-avatar :size="100" shape="square" :src="groupInfo.avatar" class="profile-avatar">
          {{ getInitials(groupInfo.name) }}
        </el-avatar>
        <h2>{{ groupInfo.name }}</h2>
        <div class="group-id">群号：{{ groupInfo.id }}</div>
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

      <el-tabs v-model="activeTab">
        <el-tab-pane label="成员" name="members">
          <div class="members-section">
            <div class="members-header">
              <h4>群成员 ({{ groupMembers.length }})</h4>
              <el-input
                v-model="memberSearchKeyword"
                placeholder="搜索成员"
                prefix-icon="Search"
                clearable
                size="small"
                class="member-search"
              />
            </div>

            <div class="members-list">
              <div
                v-for="member in filteredMembers"
                :key="member.id"
                class="member-item"
              >
                <el-avatar :size="40" :src="member.avatar" class="member-avatar">
                  {{ getInitials(member.username) }}
                </el-avatar>
                <div class="member-info">
                  <div class="member-name">
                    {{ member.username }}
                    <el-tag size="small" v-if="isGroupOwner(member.id)" type="danger">群主</el-tag>
                    <el-tag size="small" v-else-if="isGroupAdmin(member.id)" type="warning">管理员</el-tag>
                  </div>
                  <div class="member-signature" v-if="member.signature">{{ member.signature }}</div>
                  <div class="member-meta">
                    <span class="member-status" :class="{ 'online': isUserOnline(member.id) }">
                      {{ isUserOnline(member.id) ? '在线' : '离线' }}
                    </span>
                    <span class="member-join-time" v-if="member.joinedAt">
                      {{ formatJoinTime(member.joinedAt) }}加入
                    </span>
                  </div>
                </div>
                <el-dropdown trigger="click" v-if="canManageMember(member.id)">
                  <el-icon class="action-icon"><More /></el-icon>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="sendPrivateMessage(member)">
                        <el-icon><ChatDotRound /></el-icon> 私聊
                      </el-dropdown-item>
                      <el-dropdown-item 
                        v-if="canSetAdmin(member.id)" 
                        @click="setAsAdmin(member.id)"
                      >
                        <el-icon><Star /></el-icon> 设为管理员
                      </el-dropdown-item>
                      <el-dropdown-item 
                        v-if="canRemoveAdmin(member.id)" 
                        @click="removeAdmin(member.id)"
                      >
                        <el-icon><Close /></el-icon> 取消管理员
                      </el-dropdown-item>
                      <el-dropdown-item 
                        v-if="canRemoveMember(member.id)" 
                        divided
                        @click="confirmRemoveMember(member)"
                      >
                        <el-icon style="color: var(--el-color-danger)"><Delete /></el-icon>
                        <span style="color: var(--el-color-danger)">移出群组</span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
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
                      {{ getSenderName(message) }}
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
                      @dblclick="openImageViewer(item.content)"
                    >
                      <template #error>
                        <div class="image-error">
                          <el-icon><Picture /></el-icon>
                        </div>
                      </template>
                    </el-image>
                    <div class="media-info">
                      <div class="media-sender">{{ getSenderName(item) }}</div>
                    </div>
                  </template>
                  <template v-else-if="item.messageType === 'FILE'">
                    <div class="file-item">
                      <el-icon class="file-icon"><Document /></el-icon>
                      <div class="file-info">
                        <div class="file-name">{{ getFileName(item.content) }}</div>
                        <div class="file-meta">
                          <span class="file-sender">{{ getSenderName(item) }}</span>
                          <span class="file-date">{{ formatDate(item.sendAt) }}</span>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
              <el-empty v-else description="暂无共享文件" />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="设置" name="settings" v-if="isCurrentUserAdmin">
          <div class="settings-section">
            <div class="settings-form">
              <h4>基本设置</h4>
              <el-form 
                ref="editGroupFormRef"
                :model="editForm"
                :rules="editGroupRules"
                label-position="top"
              >
                <el-form-item label="群组头像" prop="avatar">
                  <div class="avatar-upload-container">
                    <el-avatar 
                      :size="80" 
                      shape="square" 
                      :src="editForm.avatar || groupInfo.avatar"
                      class="avatar-preview"
                    >
                      {{ getInitials(editForm.name || groupInfo.name) }}
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
                        {{ uploadingAvatar ? '上传中...' : '更换头像' }}
                      </el-button>
                    </el-upload>
                  </div>
                </el-form-item>
                <el-form-item label="群组名称" prop="name">
                  <el-input 
                    v-model="editForm.name" 
                    placeholder="输入新群组名称" 
                    maxlength="20"
                    show-word-limit
                  />
                </el-form-item>
                <el-form-item label="群组描述" prop="description">
                  <el-input 
                    type="textarea" 
                    v-model="editForm.description" 
                    placeholder="输入群组描述" 
                    :rows="3"
                    maxlength="100"
                    show-word-limit
                  />
                </el-form-item>
                <el-form-item>
                  <el-button 
                    type="primary" 
                    :loading="updatingGroup" 
                    @click="saveGroupSettings"
                  >
                    保存修改
                  </el-button>
                </el-form-item>
              </el-form>
            </div>

            <div class="danger-zone">
              <h4>危险区域</h4>
              <el-space direction="vertical">
                <!-- 群主显示解散按钮 -->
                <el-button 
                  v-if="isGroupOwner(currentUserId)" 
                  type="danger" 
                  plain 
                  @click="confirmDismissGroup"
                >
                  <el-icon><Delete /></el-icon> 解散群组
                </el-button>
                <!-- 普通成员显示退出按钮 -->
                <el-button 
                  v-else
                  type="warning" 
                  plain 
                  @click="confirmLeaveGroup"
                >
                  <el-icon><RemoveFilled /></el-icon> 退出群组
                </el-button>
              </el-space>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 图片查看器 -->
    <ImageViewer
      v-model:visible="imageViewerVisible"
      :image-list="currentImageList"
      :initial-index="currentImageIndex"
    />
  </el-dialog>
</template>


<style scoped>
.group-info-container {
  padding: 0;
}

.group-profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  background: linear-gradient(to bottom, var(--el-color-primary-light-9), var(--el-bg-color));
  border-radius: 0 0 50% 50% / 20px;
}

.profile-avatar {
  border: 4px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 16px;
}

.group-profile h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
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

.group-stats {
  display: flex;
  gap: 32px;
  margin-top: 12px;
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

.members-section {
  padding: 0;
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
  max-height: 400px;
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
  gap: 8px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.member-status {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-right: 8px;
}

.member-status.online {
  color: #10b981;
}

.member-meta {
  display: flex;
  align-items: center;
  margin-top: 2px;
  font-size: 12px;
}

.member-join-time {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.member-join-time::before {
  content: '•';
  margin: 0 6px;
  color: var(--el-text-color-placeholder);
}

.member-signature {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-top: 2px;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-icon {
  font-size: 20px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: color 0.3s;
}

.action-icon:hover {
  color: var(--el-color-primary);
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
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
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
  height: 120px;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.media-image:hover {
  transform: scale(1.02);
}

.media-info {
  padding: 8px;
  background-color: var(--el-fill-color-light);
}

.media-sender {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-error {
  width: 100%;
  height: 120px;
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
  font-size: 28px;
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

.file-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.file-sender::after {
  content: '•';
  margin: 0 4px;
}

.settings-section {
  padding: 20px;
}

.settings-form {
  margin-bottom: 32px;
}

.settings-form h4 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 500;
}

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

/* 响应式设计 */
@media (max-width: 768px) {
  /* 使用全局 dialog-mobile.css，这里只保留特定样式 */
  
  .group-profile h2 {
    font-size: 20px;
  }
  
  .group-description {
    font-size: 13px;
  }
  
  .group-stats {
    flex-direction: column;
    gap: 8px;
  }
  
  .members-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 0;
  }
  
  .member-item {
    padding: 10px 0;
  }
  
  .member-info {
    margin-left: 12px;
  }
  
  .media-image {
    height: 100px;
  }
}

@media (max-width: 480px) {
  .group-profile h2 {
    font-size: 18px;
  }
  
  .members-list {
    padding: 0 !important;
  }
  
  .member-avatar {
    width: 36px !important;
    height: 36px !important;
  }
  
  .media-image {
    height: 80px;
  }
}
</style>

