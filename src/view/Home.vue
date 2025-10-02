<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { useAuthStore } from '../store/auth.js'
import { useUserInfoStore } from '../store/userInfo.js'
import { friendshipStore } from '../store/friendship.js'
import { groupStore } from '../store/group.js'

const router = useRouter()
const authStore = useAuthStore()
const userInfoStore = useUserInfoStore()
const friendStore = friendshipStore()
const groupData = groupStore()

// 当前激活的选项卡
const activeTab = ref('friends')

// 搜索相关
const searchUsername = ref('')
const showSearchResults = ref(false)

// 创建群组相关
const createGroupDialog = ref(false)
const groupForm = ref({
  name: '',
  description: ''
})
const groupFormRules = {
  name: [
    { required: true, message: '请输入群组名称', trigger: 'blur' },
    { min: 2, max: 30, message: '长度应在 2 到 30 个字符之间', trigger: 'blur' }
  ],
  description: [
    { max: 200, message: '描述不能超过 200 个字符', trigger: 'blur' }
  ]
}
const groupFormRef = ref(null)

// 初始化数据
onMounted(async () => {
  // 加载好友列表
  await friendStore.fetchFriendList()
  
  // 加载好友申请
  await friendStore.fetchPendingRequests()
  
  // 加载我的群组
  await groupData.fetchMyGroups()
})

// 处理退出登录
const handleLogout = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要退出登录吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    // 清除 Pinia store 中的认证信息
    authStore.clearAuth()
    userInfoStore.clearUserInfo()
    
    ElMessage.success('已成功退出登录')
    
    // 跳转到登录页
    router.push('/login')
  } catch {
    // 用户取消退出
  }
}

// 好友功能相关
const handleSearch = async () => {
  await friendStore.searchUsers(searchUsername.value)
  showSearchResults.value = true
}

const handleSendRequest = async (userId) => {
  await friendStore.sendFriendRequest(userId)
}

const handleAcceptRequest = async (requestId) => {
  await friendStore.acceptFriendRequest(requestId)
}

const handleRejectRequest = async (requestId) => {
  await friendStore.rejectFriendRequest(requestId)
}

const handleDeleteFriend = async (friendId) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除该好友吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await friendStore.deleteFriend(friendId)
  } catch {
    // 用户取消操作
  }
}

const closeSearch = () => {
  showSearchResults.value = false
  searchUsername.value = ''
  friendStore.clearSearchResults()
}

// 群组功能相关
const handleCreateGroupSubmit = async () => {
  try {
    await groupFormRef.value.validate()
    const loading = ElLoading.service({
      lock: true,
      text: '创建群组中...',
      background: 'rgba(0, 0, 0, 0.7)',
    })
    
    const result = await groupData.createGroup(groupForm.value)
    loading.close()
    
    if (result) {
      createGroupDialog.value = false
      groupForm.value = { name: '', description: '' }
    }
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

const handleJoinGroup = async (groupId) => {
  const loading = ElLoading.service({
    lock: true,
    text: '加入群组中...',
    background: 'rgba(0, 0, 0, 0.7)',
  })
  
  await groupData.joinGroup(groupId)
  loading.close()
}

const refreshGroups = async () => {
  await groupData.fetchAllGroups()
}

// 显示好友或群组成员数量
const memberCount = (members) => {
  return members?.length || 0
}

// 判断是否已经是群组成员
const isAlreadyGroupMember = (groupId) => {
  return groupData.isGroupMember(groupId)
}

// 计算用户详情
const userInfo = computed(() => {
  return userInfoStore.userInfo || {}
})
</script>

<template>
  <div class="home-container">
    <div class="header">
      <div class="header-content">
        <h1>InsTalk</h1>
        <div class="user-menu">
          <span class="username">{{ userInfo.nickname || '欢迎回来！' }}</span>
          <el-button type="primary" @click="handleLogout">退出登录</el-button>
        </div>
      </div>
    </div>
    
    <div class="main-content">
      <div class="chat-container">
        <!-- 侧边栏 -->
        <div class="sidebar">
          <el-tabs v-model="activeTab" class="tabs-container">
            <!-- 好友列表选项卡 -->
            <el-tab-pane label="好友" name="friends">
              <div class="search-bar">
                <el-input
                  v-model="searchUsername"
                  placeholder="搜索用户名"
                  @keyup.enter="handleSearch"
                >
                  <template #append>
                    <el-button @click="handleSearch" :disabled="friendStore.loading.search">
                      <el-icon><Search /></el-icon>
                    </el-button>
                  </template>
                </el-input>
              </div>
              
              <!-- 好友申请列表 -->
              <div class="section-title">
                <span>好友申请</span>
                <el-badge :value="friendStore.pendingRequests.length" :hidden="!friendStore.pendingRequests.length" type="danger" />
              </div>
              
              <el-skeleton :loading="friendStore.loading.pending" animated :count="3" v-if="friendStore.loading.pending">
                <template #template>
                  <div class="friend-request-item skeleton-item">
                    <el-skeleton-item variant="circle" style="width: 40px; height: 40px;" />
                    <div style="flex: 1; margin-left: 16px;">
                      <el-skeleton-item variant="text" style="width: 60%;" />
                      <el-skeleton-item variant="text" style="width: 40%;" />
                    </div>
                  </div>
                </template>
              </el-skeleton>
              
              <div v-else-if="friendStore.pendingRequests.length === 0" class="empty-list">
                暂无好友申请
              </div>
              
              <div v-else class="friend-request-list">
                <div v-for="request in friendStore.pendingRequests" :key="request.id" class="friend-request-item">
                  <el-avatar :size="40" :src="request.avatar">
                    {{ request.username.charAt(0).toUpperCase() }}
                  </el-avatar>
                  <div class="request-info">
                    <div class="request-name">{{ request.nickname || request.username }}</div>
                    <div class="request-actions">
                      <el-button size="small" type="primary" @click="handleAcceptRequest(request.id)">
                        接受
                      </el-button>
                      <el-button size="small" @click="handleRejectRequest(request.id)">
                        拒绝
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 好友列表 -->
              <div class="section-title">我的好友</div>
              
              <el-skeleton :loading="friendStore.loading.friends" animated :count="5" v-if="friendStore.loading.friends">
                <template #template>
                  <div class="friend-item skeleton-item">
                    <el-skeleton-item variant="circle" style="width: 40px; height: 40px;" />
                    <el-skeleton-item variant="text" style="width: 60%; margin-left: 16px;" />
                  </div>
                </template>
              </el-skeleton>
              
              <div v-else-if="friendStore.friends.length === 0" class="empty-list">
                暂无好友，快去添加吧
              </div>
              
              <div v-else class="friend-list">
                <div v-for="friend in friendStore.friends" :key="friend.id" class="friend-item">
                  <el-avatar :size="40" :src="friend.avatar">
                    {{ friend.username.charAt(0).toUpperCase() }}
                  </el-avatar>
                  <div class="friend-name">{{ friend.nickname || friend.username }}</div>
                  <div class="friend-actions">
                    <el-dropdown trigger="click">
                      <el-icon><MoreFilled /></el-icon>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item @click="handleDeleteFriend(friend.id)">
                            删除好友
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </div>
              </div>
            </el-tab-pane>
            
            <!-- 群组选项卡 -->
            <el-tab-pane label="群组" name="groups">
              <div class="group-actions">
                <el-button type="primary" @click="createGroupDialog = true">创建群组</el-button>
                <el-button @click="refreshGroups">
                  <el-icon><Refresh /></el-icon>
                  发现群组
                </el-button>
              </div>
              
              <!-- 我的群组列表 -->
              <div class="section-title">我的群组</div>
              
              <el-skeleton :loading="groupData.loading.myGroups" animated :count="3" v-if="groupData.loading.myGroups">
                <template #template>
                  <div class="group-item skeleton-item">
                    <el-skeleton-item variant="circle" style="width: 40px; height: 40px;" />
                    <div style="flex: 1; margin-left: 16px;">
                      <el-skeleton-item variant="text" style="width: 70%;" />
                      <el-skeleton-item variant="text" style="width: 50%;" />
                    </div>
                  </div>
                </template>
              </el-skeleton>
              
              <div v-else-if="groupData.myGroups.length === 0" class="empty-list">
                暂无群组，创建或加入一个吧
              </div>
              
              <div v-else class="group-list">
                <div v-for="group in groupData.myGroups" :key="group.id" class="group-item">
                  <div class="group-avatar">
                    <el-avatar :size="40">{{ group.name.charAt(0).toUpperCase() }}</el-avatar>
                  </div>
                  <div class="group-info">
                    <div class="group-name">{{ group.name }}</div>
                    <div class="group-meta">
                      <el-tag size="small">{{ memberCount(group.members) }}人</el-tag>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 所有群组列表 -->
              <div class="section-title">
                <span>发现群组</span>
                <el-tag size="small" v-if="groupData.allGroups.length">共{{ groupData.allGroups.length }}个</el-tag>
              </div>
              
              <el-skeleton :loading="groupData.loading.allGroups" animated :count="3" v-if="groupData.loading.allGroups">
                <template #template>
                  <div class="group-item skeleton-item">
                    <el-skeleton-item variant="circle" style="width: 40px; height: 40px;" />
                    <div style="flex: 1; margin-left: 16px;">
                      <el-skeleton-item variant="text" style="width: 70%;" />
                      <el-skeleton-item variant="text" style="width: 50%;" />
                    </div>
                  </div>
                </template>
              </el-skeleton>
              
              <div v-else-if="!groupData.allGroups.length" class="empty-list">
                点击上方"发现群组"按钮查找群组
              </div>
              
              <div v-else class="group-list">
                <div v-for="group in groupData.allGroups" :key="group.id" class="group-item">
                  <div class="group-avatar">
                    <el-avatar :size="40">{{ group.name.charAt(0).toUpperCase() }}</el-avatar>
                  </div>
                  <div class="group-info">
                    <div class="group-name">{{ group.name }}</div>
                    <div class="group-meta">
                      <el-tag size="small">{{ memberCount(group.members) }}人</el-tag>
                      <div class="group-description" v-if="group.description">{{ group.description }}</div>
                    </div>
                  </div>
                  <div class="group-actions">
                    <el-button 
                      size="small" 
                      type="primary" 
                      :disabled="isAlreadyGroupMember(group.id)"
                      @click="handleJoinGroup(group.id)"
                    >
                      {{ isAlreadyGroupMember(group.id) ? '已加入' : '加入' }}
                    </el-button>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
        
        <!-- 聊天区域 -->
        <div class="chat-area">
          <div class="chat-placeholder">
            <el-empty description="选择联系人或群组开始聊天">
              <el-button type="primary">聊天功能开发中</el-button>
            </el-empty>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 用户搜索结果对话框 -->
  <el-dialog
    v-model="showSearchResults"
    title="用户搜索结果"
    width="500px"
    @close="closeSearch"
  >
    <el-skeleton :loading="friendStore.loading.search" animated :count="3" v-if="friendStore.loading.search">
      <template #template>
        <div class="search-result-item skeleton-item">
          <el-skeleton-item variant="circle" style="width: 40px; height: 40px;" />
          <el-skeleton-item variant="text" style="width: 70%; margin-left: 16px;" />
        </div>
      </template>
    </el-skeleton>
    
    <div v-else-if="friendStore.searchResults.length === 0" class="empty-list">
      未找到匹配的用户
    </div>
    
    <div v-else class="search-results">
      <div v-for="user in friendStore.searchResults" :key="user.id" class="search-result-item">
        <el-avatar :size="40" :src="user.avatar">
          {{ user.username.charAt(0).toUpperCase() }}
        </el-avatar>
        <div class="user-info">
          <div class="user-name">{{ user.nickname || user.username }}</div>
          <div class="user-username">@{{ user.username }}</div>
        </div>
        <div class="user-actions">
          <el-button size="small" type="primary" @click="handleSendRequest(user.id)">
            添加好友
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
  
  <!-- 创建群组对话框 -->
  <el-dialog
    v-model="createGroupDialog"
    title="创建新群组"
    width="500px"
  >
    <el-form 
      ref="groupFormRef"
      :model="groupForm"
      :rules="groupFormRules"
      label-width="100px"
    >
      <el-form-item label="群组名称" prop="name">
        <el-input v-model="groupForm.name" maxlength="30" show-word-limit />
      </el-form-item>
      
      <el-form-item label="群组描述" prop="description">
        <el-input 
          v-model="groupForm.description" 
          type="textarea" 
          maxlength="200" 
          show-word-limit
          :rows="4"
        />
      </el-form-item>
    </el-form>
    
    <template #footer>
      <el-button @click="createGroupDialog = false">取消</el-button>
      <el-button type="primary" @click="handleCreateGroupSubmit" :loading="groupData.loading.create">
        创建
      </el-button>
    </template>
  </el-dialog>
</template>


<style scoped>
.home-container {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.header {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 0 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  max-width: 1200px;
  margin: 0 auto;
}

.header h1 {
  color: #409eff;
  font-size: 24px;
  font-weight: 700;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 16px;
}

.username {
  color: #666;
  font-size: 14px;
}

.main-content {
  display: flex;
  justify-content: center;
  min-height: calc(100vh - 60px);
  padding: 20px;
}

/* 聊天容器布局 */
.chat-container {
  display: flex;
  width: 100%;
  max-width: 1200px;
  height: calc(100vh - 100px);
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.sidebar {
  width: 300px;
  border-right: 1px solid #eaeaea;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: #f9f9f9;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #fff;
}

.chat-placeholder {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 选项卡样式 */
.tabs-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tabs-container :deep(.el-tabs__content) {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.tabs-container :deep(.el-tabs__nav) {
  width: 100%;
}

.tabs-container :deep(.el-tabs__item) {
  flex: 1;
  text-align: center;
}

/* 搜索栏 */
.search-bar {
  margin: 16px 0;
}

/* 区块标题 */
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0 8px;
  padding-bottom: 8px;
  font-weight: 600;
  font-size: 14px;
  color: #606266;
  border-bottom: 1px solid #eaeaea;
}

/* 空列表提示 */
.empty-list {
  text-align: center;
  padding: 20px;
  color: #909399;
  font-size: 14px;
}

/* 骨架屏样式 */
.skeleton-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 8px;
  border-radius: 8px;
  background-color: white;
}

/* 好友请求项 */
.friend-request-list {
  margin-bottom: 16px;
}

.friend-request-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 8px;
  border-radius: 8px;
  background-color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s;
}

.request-info {
  flex: 1;
  margin-left: 16px;
}

.request-name {
  font-weight: 500;
  margin-bottom: 8px;
}

.request-actions {
  display: flex;
  gap: 8px;
}

/* 好友列表项 */
.friend-list {
  margin-bottom: 16px;
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 8px;
  border-radius: 8px;
  background-color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.3s;
}

.friend-item:hover {
  background-color: #f5f7fa;
}

.friend-name {
  flex: 1;
  margin-left: 16px;
  font-weight: 500;
}

.friend-actions {
  opacity: 0.6;
}

.friend-item:hover .friend-actions {
  opacity: 1;
}

/* 群组操作区 */
.group-actions {
  display: flex;
  gap: 10px;
  margin: 16px 0;
}

/* 群组列表项 */
.group-list {
  margin-bottom: 16px;
}

.group-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 8px;
  border-radius: 8px;
  background-color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.3s;
}

.group-item:hover {
  background-color: #f5f7fa;
}

.group-info {
  flex: 1;
  margin-left: 16px;
}

.group-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.group-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #909399;
  font-size: 12px;
}

.group-description {
  color: #909399;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}

/* 搜索结果样式 */
.search-results {
  max-height: 400px;
  overflow-y: auto;
}

.search-result-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eaeaea;
}

.user-info {
  flex: 1;
  margin-left: 16px;
}

.user-name {
  font-weight: 500;
}

.user-username {
  color: #909399;
  font-size: 12px;
}

.user-actions {
  margin-left: 16px;
}
</style>