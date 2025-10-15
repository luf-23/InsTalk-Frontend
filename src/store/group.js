import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { 
    createGroupService,
    joinGroupService,
    getGroupListWithMembersService,
    getMyGroupListWithMembersService,
    updateGroupInfoService
} from "@/api/group";
import { useUserInfoStore } from "@/store/userInfo";
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

    // 获取所有我已加入的群组列表
    const fetchAllGroups = async () => {
        loading.value.allGroups = true;
        try {
            const data = await getGroupListWithMembersService();
            allGroups.value = data || [];
        } catch (error) {
            console.error('获取群组列表失败:', error);
            ElMessage.error('获取群组列表失败');
        } finally {
            loading.value.allGroups = false;
        }
    };

    // 获取我创建的群组列表
    const fetchMyGroups = async () => {
        loading.value.myGroups = true;
        try {
            const data = await getMyGroupListWithMembersService();
            myGroups.value = data || [];
        } catch (error) {
            console.error('获取我的群组列表失败:', error);
            ElMessage.error('获取我的群组列表失败');
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

    // 清空所有数据（用于退出登录时）
    const clearGroupData = () => {
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
        fetchAllGroups,
        fetchMyGroups,
        createGroup,
        joinGroup,
        isGroupMember,
        updateGroupInfo,
        clearGroupData
    };
});