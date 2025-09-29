import request from "@/util/network/request";

// 获取用户信息
export const getUserInfoService = () => {
    return request({
        url: '/auth/userinfo',
        method: 'get',
        headers: {
            'Content-Type': 'application/json'
        }
    });
};