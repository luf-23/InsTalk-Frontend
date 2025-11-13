<script setup>
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Search, Avatar, UserFilled, Folder } from '@element-plus/icons-vue';
import { friendshipStore } from '@/store/friendship';
import { groupStore } from '@/store/group';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  message: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:modelValue', 'forward', 'close']);

// Store实例
const friendStore = friendshipStore();
const gStore = groupStore();

// 数据
const searchKeyword = ref('');
const selectedTargets = ref([]);
const activeTab = ref('friends'); // 'friends' | 'groups'

// 计算属性
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// 获取好友列表
const friends = computed(() => friendStore.friends || []);

// 获取群组列表
const groups = computed(() => gStore.allGroups || []);

// 过滤后的好友列表
const filteredFriends = computed(() => {
  if (!searchKeyword.value) return friends.value;
  const keyword = searchKeyword.value.toLowerCase();
  return friends.value.filter(friend => 
    friend.username?.toLowerCase().includes(keyword) ||
    friend.remark?.toLowerCase().includes(keyword)
  );
});

// 过滤后的群组列表
const filteredGroups = computed(() => {
  if (!searchKeyword.value) return groups.value;
  const keyword = searchKeyword.value.toLowerCase();
  return groups.value.filter(group => 
    group.name?.toLowerCase().includes(keyword)
  );
});

// 获取显示名称
const getDisplayName = (item, type) => {
  if (type === 'friend') {
    return item.remark || item.username || '未命名用户';
  } else {
    return item.name || '未命名群组';
  }
};

// 获取首字母
const getInitials = (name) => {
  if (!name) return '?';
  return name.substring(0, 2).toUpperCase();
};

// 是否已选中
const isSelected = (item, type) => {
  return selectedTargets.value.some(
    target => target.id === item.id && target.type === type
  );
};

// 切换选中状态
const toggleSelection = (item, type) => {
  const index = selectedTargets.value.findIndex(
    target => target.id === item.id && target.type === type
  );
  
  if (index > -1) {
    selectedTargets.value.splice(index, 1);
  } else {
    selectedTargets.value.push({
      id: item.id,
      type: type,
      name: getDisplayName(item, type),
      avatar: item.avatar
    });
  }
};

// 移除已选目标
const removeTarget = (target) => {
  const index = selectedTargets.value.findIndex(
    t => t.id === target.id && t.type === target.type
  );
  if (index > -1) {
    selectedTargets.value.splice(index, 1);
  }
};

// 确认转发
const handleConfirm = () => {
  if (selectedTargets.value.length === 0) {
    ElMessage.warning('请至少选择一个转发目标');
    return;
  }
  
  emit('forward', selectedTargets.value);
  handleClose();
};

// 关闭对话框
const handleClose = () => {
  searchKeyword.value = '';
  selectedTargets.value = [];
  activeTab.value = 'friends';
  dialogVisible.value = false;
  emit('close');
};

// 监听对话框打开
watch(dialogVisible, (newVal) => {
  if (!newVal) {
    // 对话框关闭时重置状态
    searchKeyword.value = '';
    selectedTargets.value = [];
    activeTab.value = 'friends';
  }
});
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="转发消息"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
    class="forward-dialog"
  >
    <!-- 已选择的目标 -->
    <div v-if="selectedTargets.length > 0" class="selected-targets">
      <div class="selected-label">已选择 {{ selectedTargets.length }} 个目标：</div>
      <div class="selected-list">
        <el-tag
          v-for="target in selectedTargets"
          :key="`${target.type}-${target.id}`"
          closable
          @close="removeTarget(target)"
          class="selected-tag"
        >
          <el-avatar :size="20" :src="target.avatar" class="tag-avatar">
            {{ getInitials(target.name) }}
          </el-avatar>
          <span class="tag-name">{{ target.name }}</span>
        </el-tag>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="search-box">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索好友或群组"
        clearable
        class="search-input"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <!-- 标签页 -->
    <el-tabs v-model="activeTab" class="forward-tabs">
      <!-- 好友列表 -->
      <el-tab-pane label="好友" name="friends">
        <div class="target-list">
          <div
            v-for="friend in filteredFriends"
            :key="friend.id"
            class="target-item"
            :class="{ selected: isSelected(friend, 'friend') }"
            @click="toggleSelection(friend, 'friend')"
          >
            <el-avatar :size="40" :src="friend.avatar">
              {{ getInitials(getDisplayName(friend, 'friend')) }}
            </el-avatar>
            <div class="target-info">
              <div class="target-name">{{ getDisplayName(friend, 'friend') }}</div>
              <div v-if="friend.remark && friend.username" class="target-subtitle">
                {{ friend.username }}
              </div>
            </div>
            <el-icon v-if="isSelected(friend, 'friend')" class="check-icon">
              <el-icon-check />
            </el-icon>
          </div>
          
          <el-empty
            v-if="filteredFriends.length === 0"
            description="没有找到好友"
            :image-size="80"
          />
        </div>
      </el-tab-pane>

      <!-- 群组列表 -->
      <el-tab-pane label="群组" name="groups">
        <div class="target-list">
          <div
            v-for="group in filteredGroups"
            :key="group.id"
            class="target-item"
            :class="{ selected: isSelected(group, 'group') }"
            @click="toggleSelection(group, 'group')"
          >
            <el-avatar :size="40" :src="group.avatar">
              {{ getInitials(getDisplayName(group, 'group')) }}
            </el-avatar>
            <div class="target-info">
              <div class="target-name">{{ getDisplayName(group, 'group') }}</div>
              <div class="target-subtitle">
                {{ group.members?.length || 0 }}人
              </div>
            </div>
            <el-icon v-if="isSelected(group, 'group')" class="check-icon">
              <el-icon-check />
            </el-icon>
          </div>
          
          <el-empty
            v-if="filteredGroups.length === 0"
            description="没有找到群组"
            :image-size="80"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 底部按钮 -->
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          @click="handleConfirm"
          :disabled="selectedTargets.length === 0"
        >
          转发 {{ selectedTargets.length > 0 ? `(${selectedTargets.length})` : '' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.forward-dialog {
  --selected-bg: var(--el-fill-color-light);
  --selected-border: var(--el-color-primary);
}

/* 已选择的目标区域 */
.selected-targets {
  margin-bottom: 16px;
  padding: 12px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.selected-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.selected-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px 4px 4px;
  height: 32px;
}

.tag-avatar {
  flex-shrink: 0;
}

.tag-name {
  font-size: 13px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 搜索框 */
.search-box {
  margin-bottom: 16px;
}

.search-input {
  width: 100%;
}

/* 标签页 */
.forward-tabs {
  min-height: 400px;
  display: flex;
  flex-direction: column;
}

:deep(.el-tabs__content) {
  overflow: visible;
  flex: 1;
}

:deep(.el-tab-pane) {
  display: none;
}

:deep(.el-tab-pane[aria-hidden="false"]) {
  display: block;
  height: 100%;
}

/* 目标列表 */
.target-list {
  max-height: 400px;
  overflow-y: auto;
  padding: 4px;
}

.target-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  margin-bottom: 4px;
}

.target-item:hover {
  background-color: var(--el-fill-color-light);
}

.target-item.selected {
  background-color: var(--selected-bg);
  border-color: var(--selected-border);
}

.target-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
}

.target-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.target-subtitle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.check-icon {
  font-size: 20px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

/* 底部按钮 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 滚动条样式 */
.target-list::-webkit-scrollbar {
  width: 6px;
}

.target-list::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.target-list::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.2);
}

/* 移动端优化 */
@media (max-width: 768px) {
  :deep(.el-dialog) {
    width: 95vw !important;
    max-width: 95vw !important;
    margin: 3vh auto !important;
    max-height: 94vh !important;
  }

  :deep(.el-dialog__header) {
    padding: 14px 16px !important;
  }

  :deep(.el-dialog__title) {
    font-size: 17px !important;
    font-weight: 600 !important;
  }

  :deep(.el-dialog__body) {
    padding: 12px 16px !important;
    overflow-y: auto !important;
  }

  :deep(.el-dialog__footer) {
    padding: 12px 16px !important;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  /* 已选择目标区域 */
  .selected-targets {
    margin-bottom: 12px;
    padding: 10px;
    border-radius: 6px;
  }

  .selected-label {
    font-size: 12px;
    margin-bottom: 6px;
  }

  .selected-list {
    gap: 6px;
    max-height: 100px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .selected-tag {
    font-size: 12px;
    padding: 3px 10px 3px 3px;
    height: 28px;
  }

  .tag-avatar {
    width: 22px !important;
    height: 22px !important;
    font-size: 11px !important;
  }

  .tag-name {
    max-width: 70px;
    font-size: 12px;
  }

  /* 搜索框 */
  .search-box {
    margin-bottom: 12px;
  }

  :deep(.search-input .el-input__wrapper) {
    padding: 8px 12px;
  }

  :deep(.search-input .el-input__inner) {
    font-size: 14px !important;
    height: 36px !important;
  }

  /* 标签页 */
  .forward-tabs {
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  :deep(.el-tabs__header) {
    margin: 0 0 12px 0 !important;
    flex-shrink: 0;
  }

  :deep(.el-tabs__item) {
    padding: 0 16px !important;
    height: 42px !important;
    line-height: 42px !important;
    font-size: 14px !important;
  }

  :deep(.el-tabs__nav-wrap) {
    padding: 0 !important;
  }

  :deep(.el-tabs__content) {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  :deep(.el-tab-pane) {
    height: 100%;
    display: none !important;
  }

  :deep(.el-tab-pane[aria-hidden="false"]) {
    display: block !important;
  }

  /* 目标列表 */
  .target-list {
    max-height: calc(94vh - 280px);
    min-height: 200px;
    overflow-y: auto;
    padding: 2px;
    -webkit-overflow-scrolling: touch;
  }

  .target-item {
    padding: 12px 10px;
    border-radius: 6px;
    margin-bottom: 6px;
    min-height: 64px;
    border-width: 1.5px;
    /* 增加触摸区域 */
    touch-action: manipulation;
  }

  .target-item:active {
    background-color: var(--el-fill-color);
    transform: scale(0.98);
  }

  .target-item .el-avatar {
    width: 44px !important;
    height: 44px !important;
    font-size: 16px !important;
    flex-shrink: 0;
  }

  .target-info {
    margin-left: 10px;
  }

  .target-name {
    font-size: 15px;
    line-height: 1.4;
  }

  .target-subtitle {
    font-size: 13px;
    margin-top: 2px;
  }

  .check-icon {
    font-size: 22px;
    margin-right: 4px;
  }

  /* 空状态 */
  :deep(.el-empty) {
    padding: 30px 10px !important;
  }

  :deep(.el-empty__image) {
    width: 80px !important;
  }

  :deep(.el-empty__description) {
    font-size: 13px !important;
    margin-top: 12px !important;
  }

  /* 底部按钮 */
  .dialog-footer {
    gap: 10px;
    flex-direction: row;
  }

  .dialog-footer .el-button {
    flex: 1;
    min-height: 44px !important;
    font-size: 15px !important;
    border-radius: 6px !important;
  }

  /* 滚动条优化 */
  .selected-list::-webkit-scrollbar,
  .target-list::-webkit-scrollbar {
    width: 4px;
  }

  .selected-list::-webkit-scrollbar-thumb,
  .target-list::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.15);
    border-radius: 2px;
  }
}

/* 小屏幕优化 (≤480px) */
@media (max-width: 480px) {
  :deep(.el-dialog) {
    width: 100vw !important;
    margin: 0 !important;
    max-height: 100vh !important;
    border-radius: 0 !important;
  }

  :deep(.el-dialog__header) {
    padding: 12px 16px !important;
  }

  :deep(.el-dialog__title) {
    font-size: 16px !important;
  }

  :deep(.el-dialog__body) {
    padding: 10px 12px !important;
  }

  :deep(.el-dialog__footer) {
    padding: 10px 12px !important;
  }

  .selected-targets {
    margin-bottom: 10px;
    padding: 8px;
  }

  .selected-list {
    max-height: 80px;
  }

  .selected-tag {
    height: 26px;
    padding: 2px 8px 2px 2px;
  }

  .tag-avatar {
    width: 20px !important;
    height: 20px !important;
    font-size: 10px !important;
  }

  .tag-name {
    max-width: 60px;
    font-size: 11px;
  }

  .search-box {
    margin-bottom: 10px;
  }

  :deep(.search-input .el-input__inner) {
    height: 32px !important;
    font-size: 13px !important;
  }

  :deep(.el-tabs__item) {
    padding: 0 12px !important;
    height: 40px !important;
    line-height: 40px !important;
    font-size: 13px !important;
  }

  .target-list {
    max-height: calc(100vh - 260px);
    min-height: 180px;
  }

  .target-item {
    padding: 10px 8px;
    margin-bottom: 4px;
    min-height: 60px;
  }

  .target-item .el-avatar {
    width: 40px !important;
    height: 40px !important;
    font-size: 14px !important;
  }

  .target-info {
    margin-left: 8px;
  }

  .target-name {
    font-size: 14px;
  }

  .target-subtitle {
    font-size: 12px;
  }

  .check-icon {
    font-size: 20px;
  }

  .dialog-footer .el-button {
    min-height: 42px !important;
    font-size: 14px !important;
  }
}

/* 横屏模式优化 */
@media (max-width: 768px) and (orientation: landscape) {
  :deep(.el-dialog) {
    max-height: 96vh !important;
    margin: 2vh auto !important;
  }

  :deep(.el-dialog__header) {
    padding: 10px 16px !important;
  }

  :deep(.el-dialog__body) {
    padding: 8px 16px !important;
  }

  .selected-list {
    max-height: 70px;
  }

  .target-list {
    max-height: calc(96vh - 240px);
    min-height: 150px;
  }

  .target-item {
    padding: 8px 10px;
    min-height: 56px;
  }

  .target-item .el-avatar {
    width: 40px !important;
    height: 40px !important;
  }
}

/* 触摸反馈增强 */
@media (max-width: 768px) {
  .target-item {
    transition: transform 0.1s ease, background-color 0.2s ease;
  }

  .target-item:active {
    transition-duration: 0.05s;
  }

  .dialog-footer .el-button:active {
    transform: scale(0.97);
    transition: transform 0.1s ease;
  }
}
</style>
