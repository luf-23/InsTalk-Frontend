import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { 
    createGroupService,
    joinGroupService,
    getGroupListWithMembersService,
    getMyGroupListWithMembersService
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
            console.log('获取到的所有群组:', allGroups.value);
            console.log('我的群组:', myGroups.value);
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
            console.log('获取到的我的群组:', myGroups.value);
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
            // 也要更新所有群组列表以刷新按钮状态
            await fetchAllGroups();
            return true;
        } catch (error) {
            console.error('加入群组失败:', error);
            ElMessage.error('加入群组失败');
            return false;
        } finally {
            loading.value.join = false;
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
        clearGroupData
    };
});