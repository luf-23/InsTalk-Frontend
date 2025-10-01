import axios from "axios";
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/store/auth.js';
import { useUserInfoStore } from '@/store/userInfo.js';

const baseURL = "http://localhost:8080/";

const request = axios.create({
  baseURL,
  timeout: 6000,
});

// 刷新token的请求（不需要拦截器处理）
const refreshRequest = axios.create({
  baseURL,
  timeout: 6000,
});

// 是否正在刷新token的标志
let isRefreshing = false;
// 失败请求队列
let failedQueue = [];

// 处理队列中的请求
const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  
  failedQueue = [];
};

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 在发送请求之前做些什么
    const authStore = useAuthStore();
    
    // 使用accessToken
    if (authStore.accessToken) {
      config.headers.Authorization = `${authStore.accessToken}`;
    }
    
    console.log('请求发送：', config);
    return config;
  },
  (error) => {
    // 对请求错误做些什么
    console.error('请求错误：', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    // 对响应数据做点什么
    const { data } = response;
    
    console.log('响应接收：', data);
    
    // 根据后端返回的Result格式处理
    if (data.code === 0) {
      // 成功响应，返回data部分
      return data.data;
    } else {
      // 业务错误，显示错误信息
      ElMessage.error(data.message || '请求失败');
      return Promise.reject(new Error(data.message || '请求失败'));
    }
  },
  async (error) => {
    const authStore = useAuthStore();
    const originalRequest = error.config;
    
    console.error('响应错误：', error);
    
    // 如果是401错误且还有refreshToken，尝试刷新token
    if (error.response?.status === 401 && authStore.refreshToken && !originalRequest._retry) {
      if (isRefreshing) {
        // 如果已经在刷新，将请求加入队列
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `${token}`;
          return request(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        // 使用refreshToken刷新accessToken
        const response = await refreshRequest.post('/auth/refresh', {
          refreshToken: authStore.refreshToken
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        console.log('刷新Token响应：', response);
        const { accessToken, refreshToken } = response.data;
        
        // 更新tokens
        authStore.setTokens(accessToken, refreshToken);
        
        // 处理队列中的请求
        processQueue(null, accessToken);
        
        // 重新发送原始请求
        originalRequest.headers.Authorization = `${accessToken}`;
        return request(originalRequest);
        
      } catch (refreshError) {
        // 刷新失败，清除所有认证信息和用户信息
        const userInfoStore = useUserInfoStore();
        processQueue(refreshError, null);
        authStore.clearAuth();
        userInfoStore.clearUserInfo();
        
        ElMessage.error('登录已过期，请重新登录');
        
        // 跳转到登录页
        // 这里需要根据你的路由配置调整
        // router.push('/login');
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    // 其他错误处理
    let errorMessage = '网络错误，请稍后重试';
    
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          errorMessage = data.message || '请求参数错误';
          break;
        case 401:
          errorMessage = '未授权，请重新登录';
          break;
        case 403:
          errorMessage = '拒绝访问';
          break;
        case 404:
          errorMessage = '请求地址不存在';
          break;
        case 500:
          errorMessage = '服务器内部错误';
          break;
        default:
          errorMessage = data.message || `请求失败 (${status})`;
      }
    } else if (error.request) {
      errorMessage = '网络连接失败，请检查网络';
    }
    
    ElMessage.error(errorMessage);
    return Promise.reject(error);
  }
);

export default request;

export const getBaseURL = () => {
  return baseURL;
};