import request from "@/util/request";

// 获取用户信息
export const getUserInfoService = () => {
    return request({
        url: '/user/info',
        method: 'get',
        headers: {
            'Content-Type': 'application/json'
        }
    });
};