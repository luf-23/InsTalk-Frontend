import { ElMessage } from 'element-plus';
import { getBaseURL } from './request';

class WebSocketService {
    constructor() {
        this.ws = null;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.heartbeatInterval = 15000; // 15秒心跳
        this.messageHandlers = new Map();
        this.isManualClose = false;
        this.isConnected = false;
    }

    /**
     * 连接 WebSocket
     * @param {String} token - 访问令牌
     */
    connect(token) {
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            console.log('WebSocket 已连接或正在连接');
            return;
        }

        this.isManualClose = false;
        
        try {
            // 构建 WebSocket URL
            const baseURL = getBaseURL();
            const wsProtocol = baseURL.startsWith('https://') ? 'wss://' : 'ws://';
            const wsHost = baseURL.replace(/^https?:\/\//, '').replace(/\/$/, '');
            const wsURL = `${wsProtocol}${wsHost}/ws?token=${encodeURIComponent(token)}`;
            
            console.log('正在连接 WebSocket:', wsURL);
            
            this.ws = new WebSocket(wsURL);

            this.ws.onopen = () => {
                console.log('WebSocket 连接成功');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                // 启动心跳
                this.startHeartbeat();
                
                // 触发连接成功回调
                this.triggerHandler('open', { connected: true });
            };

            this.ws.onmessage = (event) => {
                try {
                    // 如果收到的是 PONG 心跳响应，直接返回
                    if (event.data === 'PONG') {
                        console.log('收到心跳响应: PONG');
                        return;
                    }
                    
                    const data = JSON.parse(event.data);
                    console.log('收到 WebSocket 消息:', data);
                    
                    // 根据消息类型分发
                    switch (data.type) {
                        case 'NEW_MESSAGE':
                            this.triggerHandler('newMessage', data.data);
                            break;
                        case 'USER_ONLINE_STATUS':
                            this.triggerHandler('onlineStatus', data.data);
                            break;
                        default:
                            console.warn('未知的消息类型:', data.type);
                    }
                } catch (error) {
                    console.error('解析 WebSocket 消息失败:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket 错误:', error);
                this.isConnected = false;
                this.triggerHandler('error', error);
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket 连接关闭:', event.code, event.reason);
                this.isConnected = false;
                
                // 停止心跳
                this.stopHeartbeat();
                
                // 触发关闭回调
                this.triggerHandler('close', { code: event.code, reason: event.reason });
                
                // 如果不是手动关闭，尝试重连
                if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                    
                    this.reconnectTimer = setTimeout(() => {
                        this.connect(token);
                    }, this.reconnectDelay * this.reconnectAttempts);
                } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    ElMessage.error('WebSocket 连接失败，请刷新页面重试');
                }
            };
        } catch (error) {
            console.error('创建 WebSocket 连接失败:', error);
            this.isConnected = false;
        }
    }

    /**
     * 断开连接
     */
    disconnect() {
        this.isManualClose = true;
        this.stopHeartbeat();
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
        console.log('WebSocket 已断开');
    }

    /**
     * 发送消息
     * @param {Object} message - 要发送的消息对象
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket 未连接，无法发送消息');
        }
    }

    /**
     * 启动心跳
     */
    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send('PING');
            }
        }, this.heartbeatInterval);
    }

    /**
     * 停止心跳
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * 注册消息处理器
     * @param {String} type - 消息类型：'open' | 'close' | 'error' | 'newMessage' | 'onlineStatus'
     * @param {Function} handler - 处理函数
     */
    on(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    }

    /**
     * 移除消息处理器
     * @param {String} type - 消息类型
     * @param {Function} handler - 处理函数
     */
    off(type, handler) {
        if (this.messageHandlers.has(type)) {
            const handlers = this.messageHandlers.get(type);
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * 触发处理器
     * @param {String} type - 消息类型
     * @param {*} data - 数据
     */
    triggerHandler(type, data) {
        if (this.messageHandlers.has(type)) {
            this.messageHandlers.get(type).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`处理 ${type} 消息时出错:`, error);
                }
            });
        }
    }

    /**
     * 检查是否已连接
     */
    isWebSocketConnected() {
        return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}

// 导出单例
export default new WebSocketService();
