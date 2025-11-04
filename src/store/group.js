import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { 
    createGroupService,
    joinGroupService,
    getGroupListWithMembersService,
    getMyGroupListWithMembersService,
    updateGroupInfoService,
    leaveGroupService,
    deleteGroupService
} from "@/api/group";
import { useUserInfoStore } from "@/store/userInfo";
import { conversationStore } from "@/store/conversation";
import { messageStore } from "@/store/message";
import { ElMessage } from "element-plus";

export const groupStore = defineStore('group', () => {
    // 存储所有已加入的群组列表（包含成员信息）
    const allGroups = ref([]);
    // 存储我创建的群组列表（包含成员信息）
    const myGroups = ref([]);
    // 加载状态
    const loading = ref({
        allGroups: false,
        myGroups: false,
        create: false,
        join: false
    });
    // 轮询定时器
    let pollingTimer = null;
    // 轮询间隔（毫秒）- 群组列表变化频率较低，使用 5 秒轮询
    const pollingInterval = ref(5000); // 5秒轮询一次
    // 是否启用轮询
    const pollingEnabled = ref(true);

    // 获取所有我已加入的群组列表
    const fetchAllGroups = async (silent = false) => {
        loading.value.allGroups = true;
        try {
            const data = await getGroupListWithMembersService();
            allGroups.value = data || [];
        } catch (error) {
            console.error('获取群组列表失败:', error);
            if (!silent) {
                ElMessage.error('获取群组列表失败');
            }
        } finally {
            loading.value.allGroups = false;
        }
    };

    // 获取我创建的群组列表
    const fetchMyGroups = async (silent = false) => {
        loading.value.myGroups = true;
        try {
            const data = await getMyGroupListWithMembersService();
            myGroups.value = data || [];
        } catch (error) {
            console.error('获取我的群组列表失败:', error);
            if (!silent) {
                ElMessage.error('获取我的群组列表失败');
            }
        } finally {
            loading.value.myGroups = false;
        }
    };

    // 创建群组
    const createGroup = async (groupData) => {
        loading.value.create = true;
        try {
            // API 返回 GroupVO
            const groupVO = await createGroupService(groupData);
            ElMessage.success('群组创建成功');
            
            if (groupVO) {
                // 直接将返回的群组信息插入到群组列表中
                allGroups.value.push(groupVO);
                myGroups.value.push(groupVO);
            }
            
            return true;
        } catch (error) {
            console.error('创建群组失败:', error);
            ElMessage.error('创建群组失败');
            return false;
        } finally {
            loading.value.create = false;
        }
    };

    // 加入群组
    const joinGroup = async (groupId) => {
        loading.value.join = true;
        try {
            // API 返回 GroupVO
            const groupVO = await joinGroupService({ groupId });
            ElMessage.success('成功加入群组');
            
            if (groupVO) {
                // 检查该群组是否已经在列表中
                const existingIndex = allGroups.value.findIndex(g => g.id === groupVO.id);
                if (existingIndex !== -1) {
                    // 如果已存在,则更新群组信息(成员列表等)
                    allGroups.value[existingIndex] = groupVO;
                } else {
                    // 如果不存在,则添加到列表中
                    allGroups.value.push(groupVO);
                }
            }
            
            return true;
        } catch (error) {
            console.error('加入群组失败:', error);
            ElMessage.error('加入群组失败');
            return false;
        } finally {
            loading.value.join = false;
        }
    };


    // 检查用户是否是群组成员
    const isGroupMember = (groupId) => {
        const userInfoStore = useUserInfoStore();
        const userId = userInfoStore.userId;
        
        // 在所有群组中查找
        const group = allGroups.value.find(g => g.id === groupId);
        if (group) {
            // 检查成员列表中是否有当前用户
            return group.members.some(member => member.id === userId);
        }
        return false;
    };

    // 更新群组信息
    const updateGroupInfo = async (updateData) => {
        try {
            // 调用 API 更新群组信息
            await updateGroupInfoService(updateData);
            
            // 更新本地 store 中的群组信息
            const groupId = updateData.id;
            
            // 在 allGroups 中查找并更新
            const groupIndex = allGroups.value.findIndex(g => g.id === groupId);
            if (groupIndex !== -1) {
                // 合并更新的字段
                allGroups.value[groupIndex] = {
                    ...allGroups.value[groupIndex],
                    ...updateData
                };
            }
            
            // 在 myGroups 中查找并更新
            const myGroupIndex = myGroups.value.findIndex(g => g.id === groupId);
            if (myGroupIndex !== -1) {
                myGroups.value[myGroupIndex] = {
                    ...myGroups.value[myGroupIndex],
                    ...updateData
                };
            }
            
            return true;
        } catch (error) {
            console.error('更新群组信息失败:', error);
            throw error;
        }
    };

    // 退出群组
    const leaveGroup = async (groupId) => {
        try {
            // 调用 API 退出群组
            await leaveGroupService({ groupId });
            
            // 从本地 allGroups 中移除该群组
            const groupIndex = allGroups.value.findIndex(g => g.id === groupId);
            if (groupIndex !== -1) {
                allGroups.value.splice(groupIndex, 1);
            }
            
            // 如果是自己创建的群组，也从 myGroups 中移除（虽然群主一般不会退出）
            const myGroupIndex = myGroups.value.findIndex(g => g.id === groupId);
            if (myGroupIndex !== -1) {
                myGroups.value.splice(myGroupIndex, 1);
            }
            
            ElMessage.success('已退出群组');
            return true;
        } catch (error) {
            console.error('退出群组失败:', error);
            ElMessage.error('退出群组失败');
            return false;
        }
    };

    // 解散群组（仅群主可操作）
    const deleteGroup = async (groupId) => {
        try {
            // 调用 API 解散群组
            await deleteGroupService({ groupId });
            
            // 从本地 allGroups 中移除该群组
            const groupIndex = allGroups.value.findIndex(g => g.id === groupId);
            if (groupIndex !== -1) {
                allGroups.value.splice(groupIndex, 1);
            }
            
            // 从 myGroups 中移除该群组
            const myGroupIndex = myGroups.value.findIndex(g => g.id === groupId);
            if (myGroupIndex !== -1) {
                myGroups.value.splice(myGroupIndex, 1);
            }
            
            // 清理相关会话（解散群组后，静默删除与该群组的会话）
            const convStore = conversationStore();
            convStore.deleteConversation(groupId, 'group', true);
            
            // 如果当前正在与该群组聊天，清空当前聊天
            const msgStore = messageStore();
            if (msgStore.currentChat && 
                msgStore.currentChat.id === groupId && 
                msgStore.chatType === 'group') {
                msgStore.setCurrentChat(null, 'group');
            }
            
            ElMessage.success('群组已解散');
            console.log(`已解散群组 ID: ${groupId}，并清理相关会话`);
            
            return true;
        } catch (error) {
            console.error('解散群组失败:', error);
            ElMessage.error('解散群组失败');
            return false;
        }
    };

    // 启动轮询
    const startPolling = () => {
        // 检查是否启用轮询
        if (!pollingEnabled.value) {
            console.log('群组列表轮询已禁用，跳过启动');
            return;
        }
        
        // 如果已经有定时器在运行，先清除
        if (pollingTimer) {
            stopPolling();
        }
        
        console.log('开始轮询群组列表...');
        
        // 立即执行一次
        fetchAllGroups(true);
        fetchMyGroups(true);
        
        // 设置定时器
        pollingTimer = setInterval(() => {
            fetchAllGroups(true); // silent 模式，不显示错误提示
            fetchMyGroups(true);
        }, pollingInterval.value);
    };

    // 停止轮询
    const stopPolling = () => {
        if (pollingTimer) {
            console.log('停止轮询群组列表');
            clearInterval(pollingTimer);
            pollingTimer = null;
        }
    };

    // 设置轮询间隔
    const setPollingInterval = (interval) => {
        if (interval < 1000) {
            console.warn('轮询间隔不能小于1秒');
            return;
        }
        pollingInterval.value = interval;
        
        // 如果正在轮询，重启轮询以应用新的间隔
        if (pollingTimer) {
            startPolling();
        }
    };

    // 启用/禁用轮询
    const setPollingEnabled = (enabled) => {
        pollingEnabled.value = enabled;
        
        if (enabled) {
            console.log('群组列表轮询已启用');
            startPolling();
        } else {
            console.log('群组列表轮询已禁用');
            stopPolling();
        }
    };

    // 清空所有数据（用于退出登录时）
    const clearGroupData = () => {
        // 停止轮询
        stopPolling();
        
        allGroups.value = [];
        myGroups.value = [];
        loading.value = {
            allGroups: false,
            myGroups: false,
            create: false,
            join: false
        };
    };

    return {
        allGroups,
        myGroups,
        loading,
        pollingInterval,
        pollingEnabled,
        fetchAllGroups,
        fetchMyGroups,
        createGroup,
        joinGroup,
        isGroupMember,
        updateGroupInfo,
        leaveGroup,
        deleteGroup,
        clearGroupData,
        startPolling,
        stopPolling,
        setPollingInterval,
        setPollingEnabled
    };
});