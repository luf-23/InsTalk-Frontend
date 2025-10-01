import request from "@/util/network/http/request";

// 登录 - 支持用户名和邮箱两种方式
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

//获取验证码
export const getCaptchaService = (params) => {
    return request({
        url: `/auth/captcha`,
        method: 'get',
        params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
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