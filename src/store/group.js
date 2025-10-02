import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { 
    createGroupService,
    joinGroupService,
    getGroupListWithMembersService,
    getMyGroupListWithMembersService
} from "@/api/group";
import { ElMessage } from "element-plus";

export const groupStore = defineStore('group', () => {
    // 存储所有群组列表（包含成员信息）
    const allGroups = ref([]);
    // 存储我的群组列表（包含成员信息）
    const myGroups = ref([]);
    // 加载状态
    const loading = ref({
        allGroups: false,
        myGroups: false,
        create: false,
        join: false
    });

    // 获取所有群组列表
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

    // 获取我的群组列表
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
            await createGroupService(groupData);
            ElMessage.success('群组创建成功');
            // 更新群组列表
            await fetchMyGroups();
            await fetchAllGroups();
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
            await joinGroupService({ groupId });
            ElMessage.success('成功加入群组');
            // 更新群组列表
            await fetchMyGroups();
            return true;
        } catch (error) {
            console.error('加入群组失败:', error);
            ElMessage.error('加入群组失败');
            return false;
        } finally {
            loading.value.join = false;
        }
    };

    // 判断是否已经是群组成员
    const isGroupMember = (groupId) => {
        return myGroups.value.some(group => group.id === groupId);
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
        clearGroupData
    };
});