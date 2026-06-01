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
