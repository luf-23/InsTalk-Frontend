import request, { getBaseURL } from "@/util/request";
import { useAuthStore } from '@/store/auth.js';

//获取String类型的AI临时凭证
export const getAiCredentialService = () => {
    return request({
        url: '/ai/credential',
        method: 'get',
    });
};




//更新AI配置(data传AI配置信息{robotId:...,systemPrompt:...,model:...,temperature:...,topP:...,maxTokens:...,presencePenalty:...,seed:...})
//只需要传robotId和需要更新的字段即可;model只能为'deepseek-v3','deepseek-r1','qwq-plus','qwen-max-2025-01-25'
export const updateAiConfigService = (data) => {
    return request({
        url: '/ai/update',
        method: 'post',
        data,
    });
};




/*
@Data
public class UserAiConfigVO {
    private String systemPrompt;
    private String model;
    private Float temperature;
    private Integer maxTokens;//不可修改
    private Float topP;
    private Float presencePenalty;
    private Integer seed;
    private Integer dailyMessageLimit;
    private Integer dailyMessageCount;
    private LocalDate lastResetDate;
    private Integer totalMessages;
    private Long totalTokensUsed;
    private LocalDateTime lastUsedAt;
}
*/
//获取AI配置(params传robotId:robotId)
export const getAiConfigService = (params) => {
    return request({
        url: '/ai/config',
        method: 'get',
        params,
    });
};




/**
 * AI流式对话接口 - 使用SSE(Server-Sent Events)进行流式响应
 * 
 * @param {Object} data - AiChatDTO对象
 * @param {string} data.taskId - 任务ID，从getAiCredentialService获取
 * @param {number} data.robotId - Robot用户ID
 * @param {number} data.currentUserMessageId - 当前用户消息的ID，后端可通过WebSocket推送给AI用户
 * @param {number[]} data.messageIds - 历史消息ID列表，用于构建对话上下文
 * @param {Function} onMessage - 接收到消息片段时的回调函数，参数为消息内容字符串
 * @param {Function} onComplete - 对话完成时的回调函数
 * @param {Function} onError - 发生错误时的回调函数，参数为错误对象
 * @returns {Object} 包含close方法的对象，可用于中断连接
 * 
 * AiChatDTO后端定义:
 * public class AiChatDTO {
 *     private String taskId;
 *     private Long robotId;
 *     private Long currentUserMessageId;  // 后端可通过WebSocket推送给AI用户，由mgStore的sendMessage接口获取
 *     private List<Long> messageIds;
 * }
 */
export const aiChatStreamService = (data, onMessage, onComplete, onError) => {
    const baseURL = getBaseURL();
    const authStore = useAuthStore();
    const url = `${baseURL}ai/chat-stream`;
    
    let isCompleted = false; // 添加标志位，防止重复调用 onComplete
    let reader = null; // 保存 reader 引用
    
    // 使用fetch发起POST请求
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authStore.accessToken || '',
        },
        body: JSON.stringify(data),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        // 读取流式数据
        const readStream = () => {
            reader.read().then(({ done, value }) => {
                if (done) {
                    // 流结束时，只在未完成的情况下调用 onComplete
                    if (!isCompleted && onComplete) {
                        isCompleted = true;
                        onComplete();
                    }
                    return;
                }
                
                // 解码数据
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                lines.forEach(line => {
                    if (line.startsWith('data:')) {
                        const data = line.substring(5).trim();
                        
                        // 检查是否为完成信号
                        if (data === '[DONE]') {
                            if (!isCompleted && onComplete) {
                                isCompleted = true;
                                onComplete();
                            }
                        } else if (data && onMessage) {
                            onMessage(data);
                        }
                    }
                });
                
                // 继续读取
                readStream();
            }).catch(error => {
                if (onError) onError(error);
            });
        };
        
        readStream();
    })
    .catch(error => {
        if (onError) onError(error);
    });
    
    // 返回一个可以用来中断连接的对象
    return {
        close: () => {
            if (reader) {
                reader.cancel().catch(err => {
                    console.warn('取消流式传输时出错:', err);
                });
            }
        }
    };
};


