<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  ChatDotRound, More, Picture, Document, 
  Folder, FolderOpened, Check, CircleCheck, Loading, Warning, 
  Search, Download, InfoFilled, RemoveFilled, DocumentCopy, Promotion, RefreshLeft, Delete, ArrowLeft
} from '@element-plus/icons-vue';
import { messageStore } from '@/store/message';
import { conversationStore } from '@/store/conversation';
import { friendshipStore } from '@/store/friendship';
import { groupStore } from '@/store/group';
import { onlineStatusStore } from '@/store/onlineStatus';
import { useUserInfoStore } from '@/store/userInfo';
import { ossClient } from '@/util/oss';
import FriendInfoDialog from './FriendInfoDialog.vue';
import GroupInfoDialog from './GroupInfoDialog.vue';
import ImageViewer from './ImageViewer.vue';
import ContextMenu from './ContextMenu.vue';

// Props
const props = defineProps({
  isMobile: {
    type: Boolean,
    default: false
  },
  mobileView: {
    type: String,
    default: 'list'
  }
});

// Store实例
const msgStore = messageStore();
const convStore = conversationStore();
const friendStore = friendshipStore();
const gStore = groupStore();
const onlineStore = onlineStatusStore();
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
const friendInfoDialogVisible = ref(false);
const groupInfoDialogVisible = ref(false);
const isInputFocused = ref(false);
const messageInputRef = ref(null);

// 图片查看器
const imageViewerVisible = ref(false);
const currentImageList = ref([]);
const currentImageIndex = ref(0);

// 搜索消息相关
const searchDialogVisible = ref(false);
const searchKeyword = ref('');
const searchResults = ref([]);
const searchLoading = ref(false);

// 消息右键菜单相关
const messageContextMenuVisible = ref(false);
const messageContextMenuPosition = ref({ x: 0, y: 0 });
const selectedMessageForMenu = ref(null);

// 长按相关
let longPressTimer = null;
const longPressDuration = 500; // 长按时长（毫秒）
let touchStartPos = { x: 0, y: 0 };
const touchMoveThreshold = 10; // 移动阈值（像素）

// 消息菜单项
const messageMenuItems = computed(() => {
  if (!selectedMessageForMenu.value) return [];
  
  const items = [];
  const message = selectedMessageForMenu.value;
  const isOwn = isOwnMessage(message);
  
  // 根据消息类型添加对应操作
  if (message.messageType === 'TEXT') {
    items.push({
      label: '复制',
      icon: DocumentCopy,
      action: 'copy'
    });
  }
  
  if (message.messageType === 'IMAGE') {
    items.push({
      label: '保存图片',
      icon: Download,
      action: 'saveImage'
    });
  }
  
  if (message.messageType === 'FILE') {
    items.push({
      label: '下载文件',
      icon: Download,
      action: 'downloadFile'
    });
  }
  
  // 转发功能（所有消息类型）
  items.push({
    label: '转发',
    icon: Promotion,
    action: 'forward'
  });
  
  // 自己的消息可以撤回
  if (isOwn) {
    items.push({
      label: '撤回',
      icon: RefreshLeft,
      action: 'recall',
      danger: true,
      divider: true
    });
  }
  
  // 删除消息
  items.push({
    label: '删除',
    icon: Delete,
    action: 'delete',
    danger: true,
    divider: !isOwn
  });
  
  return items;
});

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

// 用户在线状态
const isUserOnline = computed(() => {
  if (!currentChat.value || chatType.value !== 'friend') {
    return false;
  }
  return onlineStore.isUserOnline(currentChat.value.id);
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

// 监听消息变化，自动滚动到底部
watch(messages, () => {
  scrollToBottom();
}, { deep: true });

// 监听当前聊天变化
watch(currentChat, (newChat, oldChat) => {
  messageInput.value = '';
  
  // 清空该会话的未读消息数(只在聊天对象变化时调用一次)
  // 跳过 API 调用，因为 ChatSidebar 中的 selectChat 已经调用过了
  if (newChat && chatType.value && (!oldChat || oldChat.id !== newChat.id || oldChat.type !== chatType.value)) {
    convStore.clearUnreadCount(newChat.id, chatType.value, true);
  }
  
  nextTick(scrollToBottom);
});

// 挂载后初始化
onMounted(() => {
  scrollToBottom();
  
  // 移动端键盘处理
  if (props.isMobile && messageInputRef.value) {
    const textarea = messageInputRef.value.$el?.querySelector('textarea');
    if (textarea) {
      // 监听输入框聚焦，滚动到底部
      textarea.addEventListener('focus', () => {
        setTimeout(() => {
          scrollToBottom();
          // 确保输入框可见
          textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 300); // 等待键盘弹出
      });
      
      // 监听输入框失焦
      textarea.addEventListener('blur', () => {
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      });
    }
  }
});

// 清理事件监听器
import { onUnmounted } from 'vue';
onUnmounted(() => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
  }
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
    return getInitials(friendInfo.value.username);
  } else {
    const sender = groupMembers.value.find(member => member.id === message.senderId);
    return getInitials(sender?.username || '?');
  }
};

// 获取发送者名称（用于群聊）
const getSenderName = (message) => {
  if (isOwnMessage(message)) return '我';
  
  const sender = groupMembers.value.find(member => member.id === message.senderId);
  return sender?.username || '未知用户';
};

// 格式化日期
const formatDate = (timestamp) => {
  if (!timestamp) return '';
  
  // 处理数组格式的日期 [year, month, day, hour, minute, second]
  let date;
  if (Array.isArray(timestamp)) {
    // 月份需要减1，因为 JavaScript 的月份从0开始
    date = new Date(timestamp[0], timestamp[1] - 1, timestamp[2], 
                    timestamp[3] || 0, timestamp[4] || 0, timestamp[5] || 0);
  } else {
    date = new Date(timestamp);
  }
  
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
  
  // 处理数组格式的日期 [year, month, day, hour, minute, second]
  let date;
  if (Array.isArray(timestamp)) {
    // 月份需要减1，因为 JavaScript 的月份从0开始
    date = new Date(timestamp[0], timestamp[1] - 1, timestamp[2], 
                    timestamp[3] || 0, timestamp[4] || 0, timestamp[5] || 0);
  } else {
    date = new Date(timestamp);
  }
  
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
  
  // 处理数组格式的日期
  const convertToDate = (timestamp) => {
    if (Array.isArray(timestamp)) {
      return new Date(timestamp[0], timestamp[1] - 1, timestamp[2], 
                      timestamp[3] || 0, timestamp[4] || 0, timestamp[5] || 0);
    }
    return new Date(timestamp);
  };
  
  const currentDate = convertToDate(message.sentAt);
  const prevDate = convertToDate(messages.value[index - 1].sentAt);
  
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
  
  // 处理数组格式的日期
  const convertToDate = (timestamp) => {
    if (Array.isArray(timestamp)) {
      return new Date(timestamp[0], timestamp[1] - 1, timestamp[2], 
                      timestamp[3] || 0, timestamp[4] || 0, timestamp[5] || 0);
    }
    return new Date(timestamp);
  };
  
  const currentTime = convertToDate(message.sentAt).getTime();
  const prevTime = convertToDate(prevMessage.sentAt).getTime();
  const timeDiff = currentTime - prevTime;
  
  return timeDiff > 2 * 60 * 1000; // 2分钟
};

// 判断是否是一组消息的最后一条
const isLastMessageOfGroup = (message, index) => {
  if (index === messages.value.length - 1) return true;
  
  const nextMessage = messages.value[index + 1];
  
  // 不同发送者或时间间隔超过2分钟视为新的一组
  if (nextMessage.senderId !== message.senderId) return true;
  
  // 处理数组格式的日期
  const convertToDate = (timestamp) => {
    if (Array.isArray(timestamp)) {
      return new Date(timestamp[0], timestamp[1] - 1, timestamp[2], 
                      timestamp[3] || 0, timestamp[4] || 0, timestamp[5] || 0);
    }
    return new Date(timestamp);
  };
  
  const currentTime = convertToDate(message.sentAt).getTime();
  const nextTime = convertToDate(nextMessage.sentAt).getTime();
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
  
  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件');
    event.target.value = '';
    return;
  }
  
  // 验证文件大小（限制10MB）
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过10MB');
    event.target.value = '';
    return;
  }
  
  try {
    // 显示上传提示
    const loadingMsg = ElMessage({
      message: '图片上传中...',
      type: 'info',
      duration: 0
    });
    
    // 初始化 OSS 客户端
    await ossClient.init();
    
    // 生成文件名和URL
    const extension = file.name.split('.').pop();
    const fileName = ossClient.generateFileName(extension);
    const imageUrl = ossClient.generateFileUrl(fileName);
    
    // 上传文件到 OSS
    await ossClient.uploadFile(fileName, file);
    
    // 关闭上传提示
    loadingMsg.close();
    
    // 构建图片消息
    const messageData = {
      content: imageUrl,
      messageType: 'IMAGE'
    };
    
    if (chatType.value === 'friend') {
      messageData.receiverId = currentChat.value.id;
    } else {
      messageData.groupId = currentChat.value.id;
    }
    
    // 发送图片消息
    const success = await msgStore.sendMessage(messageData);
    
    if (success) {
      ElMessage.success('图片发送成功');
      scrollToBottom();
    } else {
      ElMessage.error('图片发送失败');
    }
  } catch (error) {
    console.error('图片上传失败:', error);
    ElMessage.error('图片上传失败，请稍后重试');
  } finally {
    // 重置文件输入
    event.target.value = '';
  }
};

// 处理文件上传
const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  // 验证文件大小（限制50MB）
  if (file.size > 50 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过50MB');
    event.target.value = '';
    return;
  }
  
  try {
    // 显示上传提示
    const loadingMsg = ElMessage({
      message: '文件上传中...',
      type: 'info',
      duration: 0
    });
    
    // 初始化 OSS 客户端
    await ossClient.init();
    
    // 生成文件名和URL
    const extension = file.name.split('.').pop();
    const fileName = ossClient.generateFileName(extension);
    const fileUrl = ossClient.generateFileUrl(fileName);
    
    // 上传文件到 OSS
    await ossClient.uploadFile(fileName, file);
    
    // 关闭上传提示
    loadingMsg.close();
    
    // 构建文件消息
    const messageData = {
      content: fileUrl,
      messageType: 'FILE'
    };
    
    if (chatType.value === 'friend') {
      messageData.receiverId = currentChat.value.id;
    } else {
      messageData.groupId = currentChat.value.id;
    }
    
    // 发送文件消息
    const success = await msgStore.sendMessage(messageData);
    
    if (success) {
      ElMessage.success('文件发送成功');
      scrollToBottom();
    } else {
      ElMessage.error('文件发送失败');
    }
  } catch (error) {
    console.error('文件上传失败:', error);
    ElMessage.error('文件上传失败，请稍后重试');
  } finally {
    // 重置文件输入
    event.target.value = '';
  }
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
  
  // 清空输入框
  const content = messageInput.value;
  messageInput.value = '';
  
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
      // API 已返回 MessageVO 并插入到 store 中,自动滚动到底部
      scrollToBottom();
    } else {
      ElMessage.error('消息发送失败');
    }
  } catch (error) {
    console.error('发送消息出错:', error);
    ElMessage.error('消息发送出错');
  }
};

// 返回列表（移动端）
const backToList = () => {
  window.dispatchEvent(new CustomEvent('back-to-list'));
};

// 打开搜索对话框
const openSearchDialog = () => {
  searchDialogVisible.value = true;
  searchKeyword.value = '';
  searchResults.value = [];
};

// 搜索消息
const handleSearch = () => {
  if (!searchKeyword.value.trim()) {
    ElMessage.warning('请输入搜索关键词');
    return;
  }
  
  searchLoading.value = true;
  
  try {
    // 在当前聊天的消息中搜索
    const keyword = searchKeyword.value.toLowerCase();
    searchResults.value = messages.value.filter(message => {
      // 只搜索文本消息
      if (message.messageType !== 'TEXT') return false;
      
      // 检查消息内容是否包含关键词
      const content = message.content.toLowerCase();
      return content.includes(keyword);
    });
    
    if (searchResults.value.length === 0) {
      ElMessage.info('未找到相关消息');
    }
  } catch (error) {
    console.error('搜索消息出错:', error);
    ElMessage.error('搜索失败');
  } finally {
    searchLoading.value = false;
  }
};

// 清空搜索
const clearSearch = () => {
  searchKeyword.value = '';
  searchResults.value = [];
};

// 高亮关键词
const highlightKeyword = (content) => {
  if (!searchKeyword.value || !content) return content;
  
  const keyword = searchKeyword.value;
  const regex = new RegExp(`(${keyword})`, 'gi');
  return content.replace(regex, '<span class="highlight">$1</span>');
};

// 滚动到指定消息
const scrollToMessage = (message) => {
  searchDialogVisible.value = false;
  
  nextTick(() => {
    // 查找消息元素
    const messageElements = document.querySelectorAll('.message-container');
    const targetElement = Array.from(messageElements).find(el => {
      return el.querySelector(`[data-message-id="${message.id}"]`);
    });
    
    if (targetElement) {
      // 滚动到目标消息
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // 高亮显示目标消息
      targetElement.classList.add('highlight-message');
      setTimeout(() => {
        targetElement.classList.remove('highlight-message');
      }, 2000);
    } else {
      ElMessage.warning('消息不在当前可见范围内');
    }
  });
};

// 格式化完整时间（用于搜索结果）
const formatFullTime = (timestamp) => {
  if (!timestamp) return '';
  
  // 处理数组格式的日期
  let date;
  if (Array.isArray(timestamp)) {
    date = new Date(timestamp[0], timestamp[1] - 1, timestamp[2], 
                    timestamp[3] || 0, timestamp[4] || 0, timestamp[5] || 0);
  } else {
    date = new Date(timestamp);
  }
  
  if (isNaN(date.getTime())) {
    return timestamp;
  }
  
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString();
  
  const timeStr = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  if (isToday) {
    return `今天 ${timeStr}`;
  } else if (isYesterday) {
    return `昨天 ${timeStr}`;
  } else {
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

// 显示聊天信息
const showChatInfo = () => {
  if (chatType.value === 'friend') {
    friendInfoDialogVisible.value = true;
  } else if (chatType.value === 'group') {
    groupInfoDialogVisible.value = true;
  }
};

// 处理好友对话框的事件
const handleStartChat = (friend) => {
  // 已经在聊天窗口，不需要额外操作
  ElMessage.success('当前已在聊天');
};

const handleDeleteFriend = (friendId) => {
  ElMessage.info('删除好友功能开发中...');
  // TODO: 实现删除好友功能
};

// 处理群组对话框的事件
const handleSendPrivateMessage = (member) => {
  ElMessage.info('发送私聊消息功能开发中...');
  // TODO: 实现发送私聊消息功能
};

const handleLeaveGroup = (groupId) => {
  ElMessage.info('退出群组功能开发中...');
  // TODO: 实现退出群组功能
};

// 退出群组（从下拉菜单触发）
const leaveGroup = () => {
  if (chatType.value === 'group') {
    groupInfoDialogVisible.value = true;
    // 可以在对话框中进行退出操作
  }
};

// 获取姓名首字母
const getInitials = (name) => {
  if (!name) return '?';
  return name.substring(0, 2).toUpperCase();
};

// 打开图片查看器
const openImageViewer = (imageUrl) => {
  // 收集所有图片消息的URL
  const imageMessages = messages.value.filter(msg => msg.messageType === 'IMAGE');
  currentImageList.value = imageMessages.map(msg => msg.content);
  
  // 找到当前图片的索引
  currentImageIndex.value = currentImageList.value.findIndex(url => url === imageUrl);
  if (currentImageIndex.value === -1) {
    currentImageIndex.value = 0;
  }
  
  imageViewerVisible.value = true;
};

// 处理消息右键菜单
const handleMessageContextMenu = (event, message) => {
  event.preventDefault();
  selectedMessageForMenu.value = message;
  messageContextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  };
  messageContextMenuVisible.value = true;
};

// 处理触摸开始（长按）
const handleTouchStart = (event, message) => {
  const touch = event.touches[0];
  touchStartPos = { x: touch.clientX, y: touch.clientY };
  
  longPressTimer = setTimeout(() => {
    // 触发长按菜单
    selectedMessageForMenu.value = message;
    messageContextMenuPosition.value = {
      x: touch.clientX,
      y: touch.clientY
    };
    messageContextMenuVisible.value = true;
    
    // 触发震动反馈（如果设备支持）
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, longPressDuration);
};

// 处理触摸结束
const handleTouchEnd = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};

// 处理触摸移动
const handleTouchMove = (event) => {
  const touch = event.touches[0];
  const deltaX = Math.abs(touch.clientX - touchStartPos.x);
  const deltaY = Math.abs(touch.clientY - touchStartPos.y);
  
  // 如果移动距离超过阈值，取消长按
  if (deltaX > touchMoveThreshold || deltaY > touchMoveThreshold) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }
};

// 处理消息菜单选择
const handleMessageMenuSelect = async (action) => {
  if (!selectedMessageForMenu.value) return;
  
  switch (action) {
    case 'copy':
      await copyMessageText();
      break;
    case 'saveImage':
      saveImage();
      break;
    case 'downloadFile':
      downloadFile(selectedMessageForMenu.value.content);
      break;
    case 'forward':
      forwardMessage();
      break;
    case 'recall':
      recallMessage();
      break;
    case 'delete':
      deleteMessage();
      break;
  }
  
  selectedMessageForMenu.value = null;
};

// 复制消息文本
const copyMessageText = async () => {
  if (!selectedMessageForMenu.value || selectedMessageForMenu.value.messageType !== 'TEXT') {
    return;
  }
  
  try {
    await navigator.clipboard.writeText(selectedMessageForMenu.value.content);
    ElMessage.success('已复制到剪贴板');
  } catch (error) {
    console.error('复制失败:', error);
    ElMessage.error('复制失败');
  }
};

// 保存图片
const saveImage = () => {
  if (!selectedMessageForMenu.value || selectedMessageForMenu.value.messageType !== 'IMAGE') {
    return;
  }
  
  const imageUrl = selectedMessageForMenu.value.content;
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = `image_${Date.now()}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  ElMessage.success('图片保存成功');
};

// 转发消息
const forwardMessage = () => {
  ElMessage.info('转发功能开发中...');
};

// 撤回消息
const recallMessage = () => {
  if (!selectedMessageForMenu.value) return;
  
  ElMessageBox.confirm(
    '确定要撤回这条消息吗？',
    '撤回消息',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    ElMessage.info('撤回功能开发中...');
  }).catch(() => {
    // 用户取消
  });
};

// 删除消息
const deleteMessage = () => {
  if (!selectedMessageForMenu.value) return;
  
  ElMessageBox.confirm(
    '确定要删除这条消息吗？',
    '删除消息',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    ElMessage.info('删除功能开发中...');
  }).catch(() => {
    // 用户取消
  });
};
</script>

<template>
  <div class="chat-window" v-loading="loading">
    <div v-if="currentChat" class="chat-window-content">
      <!-- 聊天标题 -->
      <div class="chat-header">
        <!-- 移动端返回按钮 -->
        <button 
          v-if="isMobile && mobileView === 'chat'"
          class="mobile-back-btn"
          @click="backToList"
          aria-label="返回列表"
        >
          <el-icon><ArrowLeft /></el-icon>
        </button>
        
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
          <el-tooltip content="搜索消息" placement="bottom" :disabled="isMobile">
            <el-icon class="action-icon" @click="openSearchDialog"><Search /></el-icon>
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
              :data-message-id="message.id"
              class="message-container"
              :class="{ 
                'own-message': isOwnMessage(message),
                'first-of-group': isFirstMessageOfGroup(message, index),
                'last-of-group': isLastMessageOfGroup(message, index)
              }"
              @contextmenu.prevent="handleMessageContextMenu($event, message)"
              @touchstart="handleTouchStart($event, message)"
              @touchend="handleTouchEnd"
              @touchmove="handleTouchMove"
            >
              <!-- 显示日期分隔符 -->
              <div 
                v-if="shouldShowDateDivider(message, index)"
                class="date-divider"
              >
                <div class="date-line">
                  <span class="date-text">{{ formatDate(message.sentAt) }}</span>
                </div>
              </div>
              
              <div class="message-wrapper">
                <!-- 他人消息布局：头像 - 内容区(消息+时间) -->
                <template v-if="!isOwnMessage(message)">
                  <el-avatar 
                    :size="40" 
                    :src="getSenderAvatar(message)"
                    class="message-avatar left-avatar"
                  >
                    {{ getSenderInitials(message) }}
                  </el-avatar>
                  
                  <div class="message-content">
                    <!-- 发送者名称 (群聊中) -->
                    <div 
                      v-if="currentChat.type === 'group'" 
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
                          <div class="image-message" @dblclick="openImageViewer(message.content)">
                            <el-image 
                              :src="message.content" 
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
                        <span class="message-time">{{ formatTime(message.sentAt) }}</span>
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
                        <span class="message-time">{{ formatTime(message.sentAt) }}</span>
                      </div>
                      
                      <div class="message-bubble" :class="'message-type-' + message.messageType.toLowerCase()">
                        <!-- 根据消息类型显示内容 -->
                        <template v-if="message.messageType === 'TEXT'">
                          <div class="text-message">{{ message.content }}</div>
                        </template>
                        <template v-else-if="message.messageType === 'IMAGE'">
                          <div class="image-message" @dblclick="openImageViewer(message.content)">
                            <el-image 
                              :src="message.content" 
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
            <el-popover
              placement="top-start"
              :width="isMobile ? 'auto' : 340"
              trigger="click"
              :teleported="true"
              popper-class="emoji-popover"
            >
              <template #reference>
                <div class="toolbar-icon emoji-button" title="表情">😊</div>
              </template>
              <div class="emoji-picker">
                <div v-for="emoji in emojiList" :key="emoji" class="emoji-item" @click="insertEmoji(emoji)">
                  {{ emoji }}
                </div>
              </div>
            </el-popover>
            <el-tooltip content="发送图片" placement="top" :disabled="isMobile">
              <el-icon class="toolbar-icon" @click="triggerImageUpload"><Picture /></el-icon>
            </el-tooltip>
            <el-tooltip content="发送文件" placement="top" :disabled="isMobile">
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
            <el-tooltip content="发送消息" placement="top" :disabled="isMobile">
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

    <!-- 好友信息对话框 -->
    <FriendInfoDialog
      v-model="friendInfoDialogVisible"
      :friend-id="currentChat?.type === 'friend' ? currentChat.id : null"
      @close="friendInfoDialogVisible = false"
      @startChat="handleStartChat"
      @delete="handleDeleteFriend"
    />

    <!-- 群组信息对话框 -->
    <GroupInfoDialog
      v-model="groupInfoDialogVisible"
      :group-id="currentChat?.type === 'group' ? currentChat.id : null"
      @close="groupInfoDialogVisible = false"
      @sendMessage="handleSendPrivateMessage"
      @leave="handleLeaveGroup"
    />

    <!-- 图片查看器 -->
    <ImageViewer
      v-model:visible="imageViewerVisible"
      :image-list="currentImageList"
      :initial-index="currentImageIndex"
    />

    <!-- 消息右键菜单 -->
    <ContextMenu
      v-model:visible="messageContextMenuVisible"
      :position="messageContextMenuPosition"
      :menu-items="messageMenuItems"
      @select="handleMessageMenuSelect"
    />

    <!-- 搜索消息对话框 -->
    <el-dialog
      v-model="searchDialogVisible"
      title="搜索消息"
      width="600px"
      :close-on-click-modal="false"
      class="search-dialog"
    >
      <div class="search-content">
        <div class="search-input-wrapper">
          <el-input
            v-model="searchKeyword"
            placeholder="输入关键词搜索消息"
            clearable
            @keyup.enter="handleSearch"
            @clear="clearSearch"
            class="search-input"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          
          <el-button type="primary" @click="handleSearch" :loading="searchLoading" class="search-button">
            搜索
          </el-button>
        </div>
        
        <el-divider />
        
        <div v-loading="searchLoading" class="search-results">
          <div v-if="searchResults.length === 0 && searchKeyword" class="no-results">
            <el-empty description="未找到相关消息" />
          </div>
          
          <div v-else-if="searchResults.length === 0" class="search-tips">
            <el-icon class="tips-icon"><Search /></el-icon>
            <p>输入关键词搜索聊天消息</p>
            <ul>
              <li>支持搜索文本消息内容</li>
              <li>支持按发送者筛选</li>
              <li>点击搜索结果可定位到消息</li>
            </ul>
          </div>
          
          <div v-else class="results-list">
            <div class="results-count">找到 {{ searchResults.length }} 条相关消息</div>
            <div
              v-for="result in searchResults"
              :key="result.id"
              class="result-item"
              @click="scrollToMessage(result)"
            >
              <div class="result-header">
                <el-avatar :size="36" :src="getSenderAvatar(result)">
                  {{ getSenderInitials(result) }}
                </el-avatar>
                <div class="result-info">
                  <div class="result-sender">{{ getSenderName(result) }}</div>
                  <div class="result-time">{{ formatFullTime(result.sentAt) }}</div>
                </div>
              </div>
              <div class="result-content">
                <span v-html="highlightKeyword(result.content)"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>


<style scoped>
/* 基础布局 */
.chat-window {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color);
  position: relative;
  overflow: hidden;
}

.chat-window-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
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
  position: relative;
}

/* 移动端返回按钮 */
.mobile-back-btn {
  display: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: transparent;
  border: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--el-text-color-primary);
  margin-right: 8px;
  flex-shrink: 0;
}

.mobile-back-btn:hover {
  background-color: var(--el-fill-color-light);
}

.mobile-back-btn:active {
  transform: scale(0.95);
  background-color: var(--el-fill-color);
}

.mobile-back-btn .el-icon {
  font-size: 20px;
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
  padding: 20px 16px;
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
  margin-bottom: 16px;
  position: relative;
  max-width: 100%;
  transition: all 0.2s ease;
}

.message-container.first-of-group {
  margin-top: 12px;
}

.message-container.last-of-group {
  margin-bottom: 16px;
}

.date-divider {
  text-align: center;
  margin: 28px 0 20px;
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
  gap: 12px;
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
  margin-bottom: 6px;
  padding: 0 4px;
  font-weight: 500;
}

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  position: relative;
}

.message-bubble {
  padding: 10px 14px;
  border-radius: 8px;
  background-color: #ffffff;
  position: relative;
  display: inline-block;
  max-width: 100%;
  word-break: break-word;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
}

/* 自己的消息气泡 - QQ蓝色 */
.own-message .message-bubble {
  background: linear-gradient(135deg, #a6c1ee 0%, #b3d4fc 100%);
  color: #000000;
}

.message-bubble:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.text-message {
  white-space: pre-wrap;
  line-height: 1.6;
  font-size: 14px;
  letter-spacing: 0.3px;
}

/* 图片消息 */
.message-type-image .message-bubble {
  padding: 4px;
  background-color: transparent;
  box-shadow: none;
  border-radius: 8px;
}

.own-message .message-type-image .message-bubble {
  background: transparent;
}

.image-message {
  max-width: 240px;
  max-height: 320px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  position: relative;
}

.image-message::after {
  content: '双击查看';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  white-space: nowrap;
  z-index: 2;
}

.image-message:hover::after {
  opacity: 1;
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
  font-size: 12px;
  color: var(--el-text-color-secondary);
  opacity: 0.6;
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
  flex-shrink: 0;
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
  max-height: 300px;
  overflow-y: auto;
  overflow-x: hidden;
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
  user-select: none;
}

.emoji-item:hover {
  background-color: var(--el-fill-color-light);
  transform: scale(1.1);
}

.emoji-item:active {
  transform: scale(0.95);
}

/* 表情 Popover 样式 */
:deep(.emoji-popover) {
  padding: 4px !important;
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

/* 消息长按效果 */
.message-container {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.message-container.long-press-active {
  opacity: 0.8;
  transform: scale(0.98);
  transition: all 0.1s ease;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .mobile-back-btn {
    display: flex;
  }
  
  .chat-header {
    padding: 12px;
    height: var(--mobile-header-height, 56px);
  }
  
  .chat-title {
    flex: 1;
    min-width: 0;
  }
  
  .title-container {
    min-width: 0;
  }
  
  .chat-avatar {
    width: 36px;
    height: 36px;
    margin-right: 10px;
    flex-shrink: 0;
  }
  
  .title-info {
    min-width: 0;
    flex: 1;
  }
  
  .title-info h3 {
    font-size: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .chat-header h3 {
    font-size: 16px;
  }
  
  .header-actions {
    gap: 8px;
  }
  
  .action-button {
    width: 36px;
    height: 36px;
  }
  
  .messages-container {
    padding: 8px;
  }
  
  .message-container {
    margin-bottom: 14px;
  }
  
  .message-container.last-of-group {
    margin-bottom: 14px;
  }
  
  .message-wrapper {
    padding: 4px 0;
  }
  
  .message-content {
    max-width: calc(100% - 60px);
    font-size: 14px;
  }
  
  .message-bubble {
    padding: 10px 14px;
    max-width: 85%;
    border-radius: 8px;
  }
  
  .image-message {
    max-width: 180px;
    max-height: 240px;
    border-radius: 8px;
  }
  
  .file-message {
    max-width: 100%;
  }
  
  .file-name {
    max-width: 140px;
    font-size: 13px;
  }
  
  .file-size {
    font-size: 11px;
  }
  
  .chat-input {
    padding: 10px;
  }
  
  .input-tools {
    gap: 8px;
    margin-bottom: 8px;
  }
  
  .tool-button {
    width: 36px;
    height: 36px;
  }
  
  .input-area {
    gap: 8px;
  }
  
  :deep(.el-textarea__inner) {
    font-size: 14px;
    padding: 10px;
  }
  
  .send-button {
    height: 44px;
    padding: 0 20px;
    font-size: 14px;
  }
  
  /* Emoji 选择器优化 */
  .emoji-picker {
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
    max-height: 240px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch; /* iOS 平滑滚动 */
    overscroll-behavior: contain; /* 防止滚动穿透 */
    padding: 8px 4px;
    width: 100%;
    min-width: 280px;
    max-width: 90vw;
  }
  
  .emoji-item {
    font-size: 24px;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }
  
  /* 移动端 Popover 优化 - 防止溢出屏幕 */
  :deep(.emoji-popover.el-popper) {
    max-width: 90vw !important;
    max-height: 280px !important;
    overflow: hidden !important;
    left: 10px !important; /* 确保不会超出左边界 */
    right: auto !important;
  }
  
  :deep(.emoji-popover .el-popper__arrow) {
    display: none !important; /* 移动端隐藏箭头，简化布局 */
  }
  
  /* 确保表情选择器在移动端正确定位 */
  .input-toolbar {
    position: relative;
    z-index: 1;
  }
  
  /* 表情按钮在移动端的调整 */
  .emoji-button {
    width: 32px;
    height: 32px;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  /* 工具栏左侧按钮布局优化 */
  .toolbar-left {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  
  /* 对话框使用全局 dialog-mobile.css */
  
  /* 移动端布局优化 - 防止输入框被键盘遮挡 */
  .chat-window {
    /* 使用flex布局确保输入框始终可见 */
    height: 100vh;
    height: 100dvh; /* 动态视口高度，在键盘弹出时会自动调整 */
  }
  
  .chat-window-content {
    height: 100%;
    max-height: 100vh;
    max-height: 100dvh;
  }
  
  /* 消息列表区域 */
  .chat-messages {
    flex: 1;
    min-height: 0; /* 重要：允许flex子项收缩 */
    overflow-y: auto;
    -webkit-overflow-scrolling: touch; /* iOS 平滑滚动 */
    padding: 12px;
    padding-bottom: 20px;
  }
  
  /* 输入框区域 */
  .chat-input {
    flex-shrink: 0; /* 防止输入框被压缩 */
    position: relative;
    padding: 10px;
    background-color: var(--el-bg-color);
    border-top: 1px solid var(--el-border-color-light);
    /* 添加安全区域适配 */
    padding-bottom: max(10px, env(safe-area-inset-bottom));
  }
  
  /* 输入框容器确保正确布局 */
  .input-container {
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }
  
  /* 文本框包装器 */
  .textarea-wrapper {
    flex: 1;
    min-width: 0; /* 防止文本框溢出 */
  }
}

@media (max-width: 480px) {
  .message-bubble {
    font-size: 14px;
    padding: 10px 12px;
    border-radius: 8px;
  }
  
  .image-message {
    max-width: 150px;
    max-height: 200px;
    border-radius: 8px;
  }
  
  /* 小屏幕设备表情选择器进一步优化 */
  .emoji-picker {
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    padding: 6px 4px;
    max-height: 200px;
    min-width: 260px;
  }
  
  .emoji-item {
    font-size: 22px;
    width: 36px;
    height: 36px;
  }
  
  /* 小屏幕 Popover 优化 */
  :deep(.emoji-popover.el-popper) {
    max-width: 95vw !important;
    max-height: 240px !important;
  }
  
  .chat-input {
    padding: 8px;
  }
  
  /* 工具栏按钮间距调整 */
  .toolbar-left {
    gap: 8px;
  }
  
  .toolbar-icon {
    font-size: 16px;
  }
}

/* 横屏优化 */
@media (max-width: 768px) and (orientation: landscape) {
  .messages-container {
    max-height: calc(100vh - 150px);
  }
  
  .emoji-picker {
    max-height: 150px;
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

/* 搜索对话框样式 */
.search-dialog :deep(.el-dialog__body) {
  padding: 20px;
}

.search-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-input-wrapper {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input {
  flex: 1;
  font-size: 15px;
}

.search-button {
  flex-shrink: 0;
  min-width: 80px;
}

.search-results {
  max-height: 500px;
  overflow-y: auto;
  min-height: 300px;
}

.no-results {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.search-tips {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.tips-icon {
  font-size: 48px;
  color: var(--el-color-primary-light-5);
  margin-bottom: 16px;
}

.search-tips p {
  font-size: 16px;
  margin-bottom: 16px;
  color: var(--el-text-color-primary);
}

.search-tips ul {
  text-align: left;
  list-style: none;
  padding: 0;
  font-size: 14px;
  line-height: 2;
}

.search-tips li::before {
  content: "• ";
  color: var(--el-color-primary);
  font-weight: bold;
  margin-right: 8px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.results-count {
  padding: 8px 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.result-item {
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-item:hover {
  background-color: var(--el-fill-color-light);
  border-color: var(--el-color-primary-light-7);
  transform: translateX(4px);
}

.result-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.result-info {
  flex: 1;
  margin-left: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-sender {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.result-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.result-content {
  padding-left: 48px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
  word-break: break-word;
}

.result-content :deep(.highlight) {
  background-color: #fff59d;
  color: #000;
  padding: 2px 4px;
  border-radius: 2px;
  font-weight: 600;
}

/* 高亮消息动画 */
.highlight-message {
  animation: highlight-pulse 2s ease;
}

@keyframes highlight-pulse {
  0%, 100% {
    background-color: transparent;
  }
  50% {
    background-color: rgba(64, 158, 255, 0.1);
  }
}

/* 搜索对话框移动端适配 */
@media (max-width: 768px) {
  .search-dialog :deep(.el-dialog) {
    width: 95vw !important;
    margin: 0 auto !important;
  }
  
  .search-input-wrapper {
    gap: 8px;
  }
  
  .search-button {
    min-width: 70px;
    padding: 0 16px;
  }
  
  .search-results {
    max-height: 400px;
    min-height: 250px;
  }
  
  .search-tips {
    min-height: 250px;
  }
  
  .result-item {
    padding: 10px;
  }
  
  .result-content {
    padding-left: 0;
    margin-top: 8px;
  }
}
</style>