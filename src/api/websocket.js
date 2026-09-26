import request from "@/util/request";

/**
 * 检查用户是否在线
 */
export const checkUserOnlineService = (userId) => {
    return request({
        url: `/ws/online/${userId}`,
        method: 'GET'
    });
};

/**
 * 批量检查用户在线状态
 */
export const batchCheckUserOnlineService = (userIds) => {
    return request({
        url: '/ws/online/batch',
        method: 'POST',
        data: userIds
    });
};
