<template>
  <teleport to="body">
    <div
      v-if="visible"
      class="context-menu"
      :style="menuStyle"
      @click.stop="handleMenuClick"
    >
      <template v-for="(item, index) in menuItems" :key="index">
        <div
          v-if="!item.hidden"
          class="context-menu-item"
          :class="{ danger: item.danger, disabled: item.disabled }"
          @click="handleItemClick(item)"
        >
          <el-icon v-if="item.icon">
            <component :is="item.icon" />
          </el-icon>
          <span>{{ item.label }}</span>
        </div>
        <div v-if="item.divider && index < menuItems.length - 1" class="context-menu-divider"></div>
      </template>
    </div>
  </teleport>
</template>

<script setup>
import { computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  },
  menuItems: {
    type: Array,
    default: () => []
    // menuItems格式:
    // [
    //   { label: '复制', icon: DocumentCopy, action: 'copy', disabled: false, hidden: false },
    //   { label: '删除', icon: Delete, action: 'delete', danger: true, divider: true }
    // ]
  },
  autoAdjust: {
    type: Boolean,
    default: true
  },
  menuWidth: {
    type: Number,
    default: 160
  },
  menuHeight: {
    type: Number,
    default: 300
  }
});

const emit = defineEmits(['update:visible', 'select', 'close']);

// 计算菜单样式（包含位置调整）
const menuStyle = computed(() => {
  let { x, y } = props.position;
  
  if (props.autoAdjust) {
    // 自动调整位置，防止超出视口
    if (x + props.menuWidth > window.innerWidth) {
      x = window.innerWidth - props.menuWidth - 10;
    }
    if (y + props.menuHeight > window.innerHeight) {
      y = window.innerHeight - props.menuHeight - 10;
    }
    
    // 确保不会超出左边和上边
    x = Math.max(10, x);
    y = Math.max(10, y);
  }
  
  return {
    top: `${y}px`,
    left: `${x}px`
  };
});

// 处理菜单项点击
const handleItemClick = (item) => {
  if (item.disabled) return;
  
  emit('select', item.action, item);
  closeMenu();
};

// 处理菜单容器点击
const handleMenuClick = (event) => {
  // 阻止事件冒泡，避免触发外部的关闭事件
  event.stopPropagation();
};

// 关闭菜单
const closeMenu = () => {
  emit('update:visible', false);
  emit('close');
};

// 点击外部关闭菜单
const handleClickOutside = (event) => {
  if (props.visible) {
    closeMenu();
  }
};

// 监听visible变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // 延迟添加事件监听，避免立即触发
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }, 100);
  } else {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('contextmenu', handleClickOutside);
  }
});

// 清理
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('contextmenu', handleClickOutside);
});
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 8px 0;
  min-width: 160px;
  z-index: 9999;
  animation: fadeInMenu 0.2s ease;
  user-select: none;
}

@keyframes fadeInMenu {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.context-menu-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: var(--el-text-color-primary);
  font-size: 14px;
  gap: 8px;
}

.context-menu-item:hover:not(.disabled) {
  background-color: var(--el-fill-color-light);
}

.context-menu-item.danger {
  color: var(--el-color-danger);
}

.context-menu-item.danger:hover:not(.disabled) {
  background-color: var(--el-color-danger-light-9);
}

.context-menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.context-menu-divider {
  height: 1px;
  background-color: var(--el-border-color-lighter);
  margin: 4px 0;
}

/* 暗黑模式支持 */
:deep(.dark-mode) .context-menu {
  background-color: #2d2d2d;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

:deep(.dark-mode) .context-menu-item {
  color: #e5e5e5;
}

:deep(.dark-mode) .context-menu-item:hover:not(.disabled) {
  background-color: #383838;
}

:deep(.dark-mode) .context-menu-item.danger:hover:not(.disabled) {
  background-color: rgba(245, 108, 108, 0.2);
}

:deep(.dark-mode) .context-menu-divider {
  background-color: #444;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .context-menu {
    min-width: 140px;
    padding: 6px 0;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }
  
  .context-menu-item {
    padding: 12px 16px;
    font-size: 15px;
    min-height: var(--touch-target-min, 44px);
    display: flex;
    align-items: center;
  }
  
  .context-menu-item .el-icon {
    font-size: 18px;
  }
}

@media (max-width: 480px) {
  .context-menu {
    min-width: 120px;
  }
  
  .context-menu-item {
    padding: 10px 14px;
    font-size: 14px;
  }
}
</style>
