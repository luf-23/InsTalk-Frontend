import request from "@/util/request";

// 获取用户信息params传{id:xxx}
export const getUserInfoService = (params) => {
    return request({
        url: '/user/info',
        method: 'get',
        params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
};