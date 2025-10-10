<template>
  <el-dialog
    v-model="visible"
    title="个人信息"
    width="480px"
    :append-to-body="true"
    destroy-on-close
    @close="handleClose"
  >
    <div class="user-profile-container">
      <!-- 用户头像和基本信息 -->
      <div class="profile-header">
        <div class="avatar-wrapper">
          <el-avatar :size="100" :src="userInfo.avatar" class="profile-avatar">
            {{ getInitials(userInfo.username) }}
          </el-avatar>
          <el-tooltip content="更换头像" placement="bottom">
            <div class="avatar-overlay" @click="triggerAvatarUpload">
              <el-icon><Camera /></el-icon>
            </div>
          </el-tooltip>
        </div>
        <h2>{{ userInfo.nickname || userInfo.username }}</h2>
        <p v-if="userInfo.nickname" class="username">@{{ userInfo.username }}</p>
      </div>

      <!-- 详细信息 -->
      <el-tabs v-model="activeTab">
        <el-tab-pane label="基本信息" name="basic">
          <div class="info-section">
            <div class="info-item">
              <span class="info-label">用户名</span>
              <span class="info-value">{{ userInfo.username }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">昵称</span>
              <div class="info-value editable">
                <span v-if="!editingNickname">{{ userInfo.nickname || '未设置' }}</span>
                <el-input
                  v-else
                  v-model="editForm.nickname"
                  size="small"
                  maxlength="20"
                  show-word-limit
                />
                <el-button
                  v-if="!editingNickname"
                  type="primary"
                  link
                  size="small"
                  @click="startEditNickname"
                >
                  编辑
                </el-button>
                <div v-else class="edit-actions">
                  <el-button type="primary" link size="small" @click="saveNickname">保存</el-button>
                  <el-button link size="small" @click="cancelEditNickname">取消</el-button>
                </div>
              </div>
            </div>
            <div class="info-item">
              <span class="info-label">个人简介</span>
              <div class="info-value editable">
                <span v-if="!editingBio">{{ userInfo.bio || '这个人很懒，什么都没写' }}</span>
                <el-input
                  v-else
                  v-model="editForm.bio"
                  type="textarea"
                  :rows="3"
                  maxlength="100"
                  show-word-limit
                />
                <el-button
                  v-if="!editingBio"
                  type="primary"
                  link
                  size="small"
                  @click="startEditBio"
                >
                  编辑
                </el-button>
                <div v-else class="edit-actions">
                  <el-button type="primary" link size="small" @click="saveBio">保存</el-button>
                  <el-button link size="small" @click="cancelEditBio">取消</el-button>
                </div>
              </div>
            </div>
            <div class="info-item">
              <span class="info-label">角色</span>
              <el-tag :type="userInfo.role === 'admin' ? 'danger' : 'info'">
                {{ userInfo.role === 'admin' ? '管理员' : '用户' }}
              </el-tag>
            </div>
            <div class="info-item">
              <span class="info-label">注册时间</span>
              <span class="info-value">{{ formatDate(userInfo.createdAt) }}</span>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="账户安全" name="security">
          <div class="security-section">
            <div class="security-item" @click="showChangePassword">
              <div class="security-info">
                <el-icon class="security-icon"><Lock /></el-icon>
                <div class="security-text">
                  <h4>修改密码</h4>
                  <p>定期修改密码可以保护账户安全</p>
                </div>
              </div>
              <el-icon><ArrowRight /></el-icon>
            </div>
            <div class="security-item" @click="showBindEmail">
              <div class="security-info">
                <el-icon class="security-icon"><Message /></el-icon>
                <div class="security-text">
                  <h4>绑定邮箱</h4>
                  <p>{{ userInfo.email || '未绑定' }}</p>
                </div>
              </div>
              <el-icon><ArrowRight /></el-icon>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="统计信息" name="stats">
          <div class="stats-section">
            <div class="stat-card">
              <div class="stat-icon">
                <el-icon><UserFilled /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ friendCount }}</div>
                <div class="stat-label">好友数量</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">
                <el-icon><Collection /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ groupCount }}</div>
                <div class="stat-label">群组数量</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">
                <el-icon><ChatDotRound /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ messageCount }}</div>
                <div class="stat-label">消息数量</div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- 隐藏的文件上传输入 -->
      <input
        ref="avatarInputRef"
        type="file"
        accept="image/*"
        style="display: none"
        @change="handleAvatarUpload"
      />
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Camera, Lock, Message, ArrowRight,
  UserFilled, Collection, ChatDotRound
} from '@element-plus/icons-vue';
import { useUserInfoStore } from '@/store/userInfo';
import { friendshipStore } from '@/store/friendship';
import { groupStore } from '@/store/group';
import { messageStore } from '@/store/message';

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['update:modelValue', 'close']);

// Store
const userInfoStore = useUserInfoStore();
const friendStore = friendshipStore();
const gStore = groupStore();
const msgStore = messageStore();

// 响应式数据
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const activeTab = ref('basic');
const editingNickname = ref(false);
const editingBio = ref(false);
const avatarInputRef = ref(null);

const editForm = ref({
  nickname: '',
  bio: ''
});

// 用户信息
const userInfo = computed(() => ({
  username: userInfoStore.username,
  nickname: userInfoStore.nickname,
  avatar: userInfoStore.avatar,
  role: userInfoStore.role,
  email: userInfoStore.email,
  createdAt: userInfoStore.createdAt
}));

// 统计信息
const friendCount = computed(() => friendStore.friends.length);
const groupCount = computed(() => gStore.allGroups.length);
const messageCount = computed(() => {
  // 计算所有消息总数
  return msgStore.messages.length;
});

// 方法
const getInitials = (name) => {
  if (!name) return '?';
  return name.substring(0, 2).toUpperCase();
};

const formatDate = (date) => {
  if (!date) return '未知';
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const handleClose = () => {
  emit('close');
};

// 头像上传
const triggerAvatarUpload = () => {
  avatarInputRef.value?.click();
};

const handleAvatarUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件');
    return;
  }

  // 验证文件大小（限制5MB）
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过5MB');
    return;
  }

  // TODO: 实现头像上传逻辑
  ElMessage.info('头像上传功能开发中...');
  event.target.value = '';
};

// 编辑昵称
const startEditNickname = () => {
  editForm.value.nickname = userInfo.value.nickname || '';
  editingNickname.value = true;
};

const saveNickname = async () => {
  if (!editForm.value.nickname.trim()) {
    ElMessage.warning('昵称不能为空');
    return;
  }

  // TODO: 调用API保存昵称
  ElMessage.success('昵称保存成功');
  userInfoStore.nickname = editForm.value.nickname;
  editingNickname.value = false;
};

const cancelEditNickname = () => {
  editingNickname.value = false;
  editForm.value.nickname = '';
};

// 编辑个人简介
const startEditBio = () => {
  editForm.value.bio = userInfo.value.bio || '';
  editingBio.value = true;
};

const saveBio = async () => {
  // TODO: 调用API保存简介
  ElMessage.success('个人简介保存成功');
  userInfoStore.bio = editForm.value.bio;
  editingBio.value = false;
};

const cancelEditBio = () => {
  editingBio.value = false;
  editForm.value.bio = '';
};

// 修改密码
const showChangePassword = () => {
  ElMessage.info('修改密码功能开发中...');
};

// 绑定邮箱
const showBindEmail = () => {
  ElMessage.info('绑定邮箱功能开发中...');
};
</script>

<style scoped>
.user-profile-container {
  padding: 0;
}

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  background: linear-gradient(to bottom, var(--el-color-primary-light-9), var(--el-bg-color));
  border-radius: 0 0 50% 50% / 20px;
}

.avatar-wrapper {
  position: relative;
  margin-bottom: 16px;
}

.profile-avatar {
  border: 4px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.avatar-overlay {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 32px;
  height: 32px;
  background-color: var(--el-color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 2px solid white;
  transition: all 0.3s;
}

.avatar-overlay:hover {
  background-color: var(--el-color-primary-dark-2);
  transform: scale(1.1);
}

.avatar-overlay .el-icon {
  color: white;
  font-size: 16px;
}

.profile-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.username {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.info-section {
  padding: 20px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  min-width: 80px;
}

.info-value {
  flex: 1;
  font-size: 14px;
  color: var(--el-text-color-primary);
  text-align: right;
}

.info-value.editable {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.edit-actions {
  display: flex;
  gap: 4px;
}

.security-section {
  padding: 20px;
}

.security-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 12px;
  background-color: var(--el-fill-color-light);
}

.security-item:hover {
  background-color: var(--el-fill-color);
}

.security-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.security-icon {
  font-size: 24px;
  color: var(--el-color-primary);
}

.security-text h4 {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.security-text p {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stats-section {
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-color-primary-light-8));
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  font-size: 32px;
  color: var(--el-color-primary);
  margin-bottom: 12px;
}

.stat-info {
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-color-primary);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stats-section {
    grid-template-columns: 1fr;
  }
}
</style>
