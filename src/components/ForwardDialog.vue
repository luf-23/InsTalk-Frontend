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
}

:deep(.el-tabs__content) {
  overflow: visible;
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
    width: 90% !important;
  }

  .forward-tabs {
    min-height: 300px;
  }

  .target-list {
    max-height: 300px;
  }

  .selected-tag {
    font-size: 12px;
  }

  .tag-name {
    max-width: 80px;
  }
}
</style>
