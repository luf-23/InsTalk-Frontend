import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { 
    getFriendListService, 
    getPendingListService, 
    sendFriendRequestService, 
    acceptFriendRequestService,
    rejectFriendRequestService,
    deleteFriendService,
    searchUserByUsernameService
} from "@/api/friendship";
import { ElMessage } from "element-plus";

export const friendshipStore = defineStore('friendship', () => {
    // 存储好友列表
    const friends = ref([]);
    // 存储待处理的好友申请列表
    const pendingRequests = ref([]);
    // 存储搜索结果
    const searchResults = ref([]);
    // 加载状态
    const loading = ref({
        friends: false,
        pending: false,
        search: false
    });

    // 获取好友列表
    const fetchFriendList = async () => {
        loading.value.friends = true;
        try {
            const data = await getFriendListService();
            friends.value = data || [];
        } catch (error) {
            console.error('获取好友列表失败:', error);
            ElMessage.error('获取好友列表失败');
        } finally {
            loading.value.friends = false;
        }
    };

    // 获取待处理的好友申请
    const fetchPendingRequests = async () => {
        loading.value.pending = true;
        try {
            const data = await getPendingListService();
            pendingRequests.value = data || [];
        } catch (error) {
            console.error('获取好友申请列表失败:', error);
            ElMessage.error('获取好友申请列表失败');
        } finally {
            loading.value.pending = false;
        }
    };

    // 发送好友请求
    const sendFriendRequest = async (userId) => {
        try {
            await sendFriendRequestService({ id: userId });
            ElMessage.success('好友请求已发送');
            return true;
        } catch (error) {
            console.error('发送好友请求失败:', error);
            ElMessage.error('发送好友请求失败');
            return false;
        }
    };

    // 接受好友请求
    const acceptFriendRequest = async (requestId) => {
        try {
            // API 返回 FriendVO
            const friendVO = await acceptFriendRequestService({ id: requestId });
            ElMessage.success('已接受好友请求');
            
            if (friendVO) {
                // 直接将返回的好友信息插入到好友列表中
                friends.value.push(friendVO);
                
                // 从待处理列表中移除该请求
                const index = pendingRequests.value.findIndex(req => req.id === requestId);
                if (index !== -1) {
                    pendingRequests.value.splice(index, 1);
                }
            }
            
            return true;
        } catch (error) {
            console.error('接受好友请求失败:', error);
            ElMessage.error('接受好友请求失败');
            return false;
        }
    };

    // 拒绝好友请求
    const rejectFriendRequest = async (requestId) => {
        try {
            await rejectFriendRequestService({ id: requestId });
            ElMessage.success('已拒绝好友请求');
            
            // 直接从待处理列表中移除该请求
            const index = pendingRequests.value.findIndex(req => req.id === requestId);
            if (index !== -1) {
                pendingRequests.value.splice(index, 1);
            }
            
            return true;
        } catch (error) {
            console.error('拒绝好友请求失败:', error);
            ElMessage.error('拒绝好友请求失败');
            return false;
        }
    };

    // 删除好友
    const deleteFriend = async (friendId) => {
        try {
            await deleteFriendService({ id: friendId });
            ElMessage.success('已删除好友');
            
            // 直接从好友列表中移除该好友
            const index = friends.value.findIndex(friend => friend.id === friendId);
            if (index !== -1) {
                friends.value.splice(index, 1);
            }
            
            return true;
        } catch (error) {
            console.error('删除好友失败:', error);
            ElMessage.error('删除好友失败');
            return false;
        }
    };

    // 搜索用户
    const searchUsers = async (username) => {
        if (!username.trim()) {
            searchResults.value = [];
            return;
        }
        
        loading.value.search = true;
        try {
            const data = await searchUserByUsernameService({ username });
            searchResults.value = data || [];
        } catch (error) {
            console.error('搜索用户失败:', error);
            ElMessage.error('搜索用户失败');
            searchResults.value = [];
        } finally {
            loading.value.search = false;
        }
    };

    // 清空搜索结果
    const clearSearchResults = () => {
        searchResults.value = [];
    };

    // 清空所有数据（用于退出登录时）
    const clearFriendshipData = () => {
        friends.value = [];
        pendingRequests.value = [];
        searchResults.value = [];
        loading.value = {
            friends: false,
            pending: false,
            search: false
        };
    };

    return {
        friends,
        pendingRequests,
        searchResults,
        loading,
        fetchFriendList,
        fetchPendingRequests,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        deleteFriend,
        searchUsers,
        clearSearchResults,
        clearFriendshipData
    };
});