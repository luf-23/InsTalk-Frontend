import axios from "axios";
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/store/auth.js';
import { useUserInfoStore } from '@/store/userInfo.js';

const baseURL = "http://localhost:8080/";
//const baseURL = "http://43.142.2.253/api/";
//const baseURL = "http://192.168.159.105:8080/";
const request = axios.create({
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
      
      // 直接使用 axios 发送刷新请求，避免走响应拦截器
      try {
        console.log('Attempting to refresh token...');
        
        const refreshResponse = await axios.post(`${baseURL}auth/refresh`, {
          refreshToken: authStore.refreshToken
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Refresh response:', refreshResponse.data);
        
        // 检查业务状态码
        if (refreshResponse.data.code === 0) {
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data.data;
          
          // 更新tokens
          authStore.setTokens(newAccessToken, newRefreshToken);
          
          // 处理队列中的请求
          processQueue(null, newAccessToken);
          
          // 重新发送原始请求，确保使用新的token
          originalRequest.headers.Authorization = `${newAccessToken}`;
          return request(originalRequest);
        } else {
          // 业务失败，抛出错误进入 catch
          throw new Error(refreshResponse.data.message || 'Token刷新失败');
        }
        
      } catch (refreshError) {
        console.log('Token refresh failed, clearing auth and redirecting to login');
        
        // 刷新失败，清除所有认证信息和用户信息
        const userInfoStore = useUserInfoStore();
        processQueue(refreshError, null);
        authStore.clearAuth();
        userInfoStore.clearUserInfo();
        
        ElMessage.error('登录已过期，请重新登录');
        
        // 跳转到登录页 - 使用动态导入避免循环依赖，并确保跳转成功
        import('@/router/index.js').then(({ default: router }) => {
          console.log('Router loaded, pushing to /login');
          router.push('/login').catch(err => {
            console.error('Router push failed:', err);
            // 如果路由跳转失败，使用原生方法强制跳转
            window.location.href = '/login';
          });
        }).catch(err => {
          console.error('Failed to load router:', err);
          // 如果动态导入失败，直接使用原生方法跳转
          window.location.href = '/login';
        });
        
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