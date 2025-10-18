<template>
  <Teleport to="body">
    <Transition name="image-viewer-fade">
      <div 
        v-if="visible" 
        class="image-viewer-wrapper"
        @click.self="handleClose"
        @wheel.prevent="handleWheel"
      >
        <!-- 顶部工具栏 -->
        <div class="image-viewer-toolbar">
          <div class="toolbar-left">
            <span class="image-index">{{ currentIndex + 1 }} / {{ imageList.length }}</span>
          </div>
          <div class="toolbar-center">
            <el-tooltip content="放大 (↑)" placement="bottom">
              <el-icon class="toolbar-btn" @click="zoomIn">
                <ZoomIn />
              </el-icon>
            </el-tooltip>
            <el-tooltip content="缩小 (↓)" placement="bottom">
              <el-icon class="toolbar-btn" @click="zoomOut">
                <ZoomOut />
              </el-icon>
            </el-tooltip>
            <el-tooltip content="1:1 (Ctrl + 0)" placement="bottom">
              <el-icon class="toolbar-btn" @click="resetScale">
                <FullScreen />
              </el-icon>
            </el-tooltip>
            <span class="scale-indicator">{{ Math.round(scale * 100) }}%</span>
          </div>
          <div class="toolbar-right">
            <el-tooltip content="逆时针旋转 (←)" placement="bottom">
              <el-icon class="toolbar-btn" @click="rotateLeft">
                <RefreshLeft />
              </el-icon>
            </el-tooltip>
            <el-tooltip content="顺时针旋转 (→)" placement="bottom">
              <el-icon class="toolbar-btn" @click="rotateRight">
                <RefreshRight />
              </el-icon>
            </el-tooltip>
            <el-tooltip content="下载" placement="bottom">
              <el-icon class="toolbar-btn" @click="downloadImage">
                <Download />
              </el-icon>
            </el-tooltip>
            <el-tooltip content="关闭 (ESC)" placement="bottom">
              <el-icon class="toolbar-btn close-btn" @click="handleClose">
                <Close />
              </el-icon>
            </el-tooltip>
          </div>
        </div>

        <!-- 图片容器 -->
        <div class="image-viewer-container" ref="containerRef">
          <Transition name="image-slide" mode="out-in">
            <div 
              :key="currentImage"
              class="image-wrapper"
              @mousedown="handleMouseDown"
              @dblclick="handleDoubleClick"
            >
              <img
                :src="currentImage"
                :style="imageStyle"
                class="viewer-image"
                @load="handleImageLoad"
                @error="handleImageError"
                draggable="false"
              />
            </div>
          </Transition>

          <!-- 加载中 -->
          <div v-if="loading" class="loading-overlay">
            <el-icon class="is-loading loading-icon">
              <Loading />
            </el-icon>
            <span>加载中...</span>
          </div>

          <!-- 加载失败 -->
          <div v-if="error" class="error-overlay">
            <el-icon class="error-icon">
              <Picture />
            </el-icon>
            <span>图片加载失败</span>
          </div>
        </div>

        <!-- 左右切换按钮 -->
        <Transition name="fade">
          <div 
            v-if="imageList.length > 1 && !loading"
            class="navigation-buttons"
          >
            <el-tooltip content="上一张 (A)" placement="right">
              <div 
                class="nav-btn prev-btn"
                :class="{ disabled: currentIndex === 0 }"
                @click="prevImage"
              >
                <el-icon><ArrowLeft /></el-icon>
              </div>
            </el-tooltip>
            <el-tooltip content="下一张 (D)" placement="left">
              <div 
                class="nav-btn next-btn"
                :class="{ disabled: currentIndex === imageList.length - 1 }"
                @click="nextImage"
              >
                <el-icon><ArrowRight /></el-icon>
              </div>
            </el-tooltip>
          </div>
        </Transition>

        <!-- 缩略图列表 -->
        <Transition name="slide-up">
          <div 
            v-if="imageList.length > 1 && showThumbnails"
            class="thumbnail-list"
          >
            <div 
              v-for="(image, index) in imageList"
              :key="index"
              class="thumbnail-item"
              :class="{ active: index === currentIndex }"
              @click="jumpToImage(index)"
            >
              <img :src="image" alt="" />
              <div class="thumbnail-mask">
                <span>{{ index + 1 }}</span>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Close, ZoomIn, ZoomOut, Download, RefreshLeft, RefreshRight,
  ArrowLeft, ArrowRight, Loading, Picture, FullScreen
} from '@element-plus/icons-vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  imageList: {
    type: Array,
    default: () => []
  },
  initialIndex: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['update:visible', 'close']);

// 状态
const currentIndex = ref(0);
const scale = ref(1);
const rotation = ref(0);
const offsetX = ref(0);
const offsetY = ref(0);
const loading = ref(false);
const error = ref(false);
const showThumbnails = ref(true);

// DOM引用
const containerRef = ref(null);

// 拖拽相关
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const startOffsetX = ref(0);
const startOffsetY = ref(0);

// 计算属性
const currentImage = computed(() => {
  return props.imageList[currentIndex.value] || '';
});

const imageStyle = computed(() => ({
  transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value}) rotate(${rotation.value}deg)`,
  transition: isDragging.value ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: isDragging.value ? 'grabbing' : (scale.value > 1 ? 'grab' : 'default')
}));

// 监听visible变化
watch(() => props.visible, (val) => {
  if (val) {
    currentIndex.value = props.initialIndex;
    resetTransform();
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});

// 监听当前索引变化
watch(currentIndex, () => {
  resetTransform();
  error.value = false;
  loading.value = true;
});

// 图片加载完成
const handleImageLoad = () => {
  loading.value = false;
  error.value = false;
};

// 图片加载失败
const handleImageError = () => {
  loading.value = false;
  error.value = true;
  ElMessage.error('图片加载失败');
};

// 关闭查看器
const handleClose = () => {
  emit('update:visible', false);
  emit('close');
};

// 放大
const zoomIn = () => {
  if (scale.value < 5) {
    scale.value = Math.min(scale.value + 0.2, 5);
  }
};

// 缩小
const zoomOut = () => {
  if (scale.value > 0.2) {
    scale.value = Math.max(scale.value - 0.2, 0.2);
  }
};

// 重置缩放
const resetScale = () => {
  scale.value = 1;
  offsetX.value = 0;
  offsetY.value = 0;
  rotation.value = 0;
};

// 逆时针旋转
const rotateLeft = () => {
  rotation.value -= 90;
};

// 顺时针旋转
const rotateRight = () => {
  rotation.value += 90;
};

// 下载图片
const downloadImage = async () => {
  try {
    const response = await fetch(currentImage.value);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `image_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    ElMessage.success('图片下载成功');
  } catch (error) {
    console.error('下载失败:', error);
    // 如果fetch失败，尝试直接打开
    window.open(currentImage.value, '_blank');
  }
};

// 上一张
const prevImage = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  }
};

// 下一张
const nextImage = () => {
  if (currentIndex.value < props.imageList.length - 1) {
    currentIndex.value++;
  }
};

// 跳转到指定图片
const jumpToImage = (index) => {
  currentIndex.value = index;
};

// 重置变换
const resetTransform = () => {
  scale.value = 1;
  rotation.value = 0;
  offsetX.value = 0;
  offsetY.value = 0;
};

// 鼠标按下
const handleMouseDown = (e) => {
  if (scale.value <= 1) return;
  
  isDragging.value = true;
  dragStartX.value = e.clientX;
  dragStartY.value = e.clientY;
  startOffsetX.value = offsetX.value;
  startOffsetY.value = offsetY.value;
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

// 鼠标移动
const handleMouseMove = (e) => {
  if (!isDragging.value) return;
  
  const deltaX = e.clientX - dragStartX.value;
  const deltaY = e.clientY - dragStartY.value;
  
  offsetX.value = startOffsetX.value + deltaX;
  offsetY.value = startOffsetY.value + deltaY;
};

// 鼠标松开
const handleMouseUp = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
};

// 双击重置
const handleDoubleClick = () => {
  if (scale.value === 1) {
    scale.value = 2;
  } else {
    resetScale();
  }
};

// 滚轮缩放
const handleWheel = (e) => {
  e.preventDefault();
  
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  const newScale = scale.value + delta;
  
  if (newScale >= 0.2 && newScale <= 5) {
    scale.value = newScale;
  }
};

// 键盘事件
const handleKeydown = (e) => {
  if (!props.visible) return;
  
  switch (e.key) {
    case 'Escape':
      handleClose();
      break;
    case 'ArrowUp':
      e.preventDefault();
      zoomIn();
      break;
    case 'ArrowDown':
      e.preventDefault();
      zoomOut();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (e.shiftKey) {
        rotateLeft();
      } else {
        prevImage();
      }
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (e.shiftKey) {
        rotateRight();
      } else {
        nextImage();
      }
      break;
    case '0':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        resetScale();
      }
      break;
    case 'a':
    case 'A':
      e.preventDefault();
      prevImage();
      break;
    case 'd':
    case 'D':
      e.preventDefault();
      nextImage();
      break;
  }
};

// 生命周期
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = '';
});
</script>

<style scoped>
.image-viewer-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background-color: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  user-select: none;
}

/* 顶部工具栏 */
.image-viewer-toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 100%);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  z-index: 10;
  color: #333333;
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.toolbar-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.image-index {
  font-size: 16px;
  font-weight: 500;
  color: #333333;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
}

.toolbar-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #333333;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.toolbar-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
  transform: scale(1.1);
}

.toolbar-btn:active {
  transform: scale(0.95);
}

.close-btn:hover {
  background-color: rgba(255, 59, 48, 0.2);
  color: #ff3b30;
}

.scale-indicator {
  font-size: 14px;
  font-weight: 500;
  color: #333333;
  min-width: 50px;
  text-align: center;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 6px 12px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

/* 图片容器 */
.image-viewer-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.image-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.viewer-image {
  max-width: 90vw;
  max-height: 80vh;
  object-fit: contain;
  transform-origin: center;
  will-change: transform;
}

/* 加载和错误覆盖层 */
.loading-overlay,
.error-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #666666;
  font-size: 16px;
  z-index: 20;
}

.loading-icon,
.error-icon {
  font-size: 48px;
}

.error-icon {
  color: #ff6b6b;
}

/* 导航按钮 */
.navigation-buttons {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  display: flex;
  justify-content: space-between;
  padding: 0 32px;
  pointer-events: none;
  z-index: 10;
}

.nav-btn {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #333333;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  pointer-events: auto;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.nav-btn:hover:not(.disabled) {
  background-color: rgba(255, 255, 255, 0.95);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.nav-btn:active:not(.disabled) {
  transform: scale(0.95);
}

.nav-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* 缩略图列表 */
.thumbnail-list {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  max-width: 90vw;
  overflow-x: auto;
  backdrop-filter: blur(10px);
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.thumbnail-list::-webkit-scrollbar {
  height: 4px;
}

.thumbnail-list::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.thumbnail-list::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.3);
}

.thumbnail-item {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.thumbnail-item:hover {
  border-color: rgba(255, 255, 255, 0.5);
  transform: scale(1.05);
}

.thumbnail-item.active {
  border-color: #409eff;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.5);
}

.thumbnail-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333333;
  font-size: 14px;
  font-weight: 500;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.thumbnail-item:hover .thumbnail-mask,
.thumbnail-item.active .thumbnail-mask {
  opacity: 1;
}

/* 底部提示 */
.viewer-tips {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  color: #666666;
  font-size: 13px;
  text-align: center;
  padding: 8px 16px;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 20px;
  backdrop-filter: blur(10px);
  white-space: nowrap;
  z-index: 5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 动画 */
.image-viewer-fade-enter-active,
.image-viewer-fade-leave-active {
  transition: opacity 0.3s ease;
}

.image-viewer-fade-enter-from,
.image-viewer-fade-leave-to {
  opacity: 0;
}

.image-slide-enter-active,
.image-slide-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.image-slide-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.image-slide-leave-to {
  opacity: 0;
  transform: scale(1.2);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .image-viewer-toolbar {
    padding: 0 16px;
  }
  
  .toolbar-center {
    display: none;
  }
  
  .toolbar-btn {
    width: 32px;
    height: 32px;
    font-size: 18px;
  }
  
  .navigation-buttons {
    padding: 0 16px;
  }
  
  .nav-btn {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }
  
  .thumbnail-list {
    bottom: 10px;
    padding: 8px 12px;
    gap: 8px;
  }
  
  .thumbnail-item {
    width: 48px;
    height: 48px;
  }
  
  .viewer-tips {
    display: none;
  }
}

/* 暗黑模式优化 */
@media (prefers-color-scheme: dark) {
  .image-viewer-wrapper {
    background-color: rgba(0, 0, 0, 0.4);
  }
}
</style>
