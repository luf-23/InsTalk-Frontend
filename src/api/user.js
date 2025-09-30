import request from "@/util/network/http/request";

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