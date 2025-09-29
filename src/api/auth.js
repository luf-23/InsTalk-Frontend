import request from "@/util/network/request";

// 登录
export const loginService = (data) => {
    return request({
        url: '/auth/login',
        method: 'post',
        data,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};

// 注册
export const registerService = (data) => {
    return request({
        url: '/auth/register',
        method: 'post',
        data,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};

// 登出
export const logoutService = () => {
    return request({
        url: '/auth/logout',
        method: 'post',
        headers: {
            'Content-Type': 'application/json'
        }
    });
};

// 刷新token（通常不需要手动调用，拦截器会自动处理）
export const refreshTokenService = (refreshToken) => {
    return request({
        url: '/auth/refresh',
        method: 'post',
        data: { refreshToken },
        headers: {
            'Content-Type': 'application/json'
        }
    });
};


// 修改密码
export const changePasswordService = (data) => {
    return request({
        url: '/auth/change-password',
        method: 'post',
        data,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};