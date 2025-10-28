import request, { getBaseURL } from "@/util/request";
import { useAuthStore } from '@/store/auth.js';

//获取String类型的AI临时凭证
export const getAiCredentialService = () => {
    return request({
        url: '/ai/credential',
        method: 'get',
    });
};




/*
@Data
public class AiConversationVO {
    private Long id;
    private Long robotId;
    private String title;
    private String summary;
    private LocalDateTime lastMessageAt;
    private LocalDateTime createdAt;
}
*/
//创建AI对话(params传robotId:robotId)
export const createAiConversationService = (params) => {
    return request({
        url: '/ai/createConversation',
        method: 'post',
        params,
    });
};


/*
@Data
public class AiConversationVO {
    private Long id;
    private Long robotId;
    private String title;
    private String summary;
    private LocalDateTime lastMessageAt;
    private LocalDateTime createdAt;
}
*/
//获取AI对话列表(params传robotId:robotId)
export const getAiConversationListService = (params) => {
    return request({
        url: '/ai/conversationList',
        method: 'get',
        params,
    });
};


/*
@Data
public class AiMessageVO {
    private Long id;
    private String role;//USER or ASSISTANT
    private String content;
    private LocalDateTime sentAt;
}
*/
//根据conversationId获取AI对话消息列表(params传conversationId:conversationId)
export const getAiMessageListService = (params) => {
    return request({
        url: '/ai/messageList',
        method: 'get',
        params,
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
 * data传AiChatDTO对象

public class AiChatDTO {
    private String taskId;
    private Long conversationId;
    private String currentUserMessage;
    private List<AiChatMessage> messageHistory;
    
    public static class AiChatMessage{
        private String role;//USER or ASSISTANT
        private String content;
    }
}

 * taskId从getAiCredentialService获取
 * conversationId为对话ID
 * message为用户发送的消息内容
 * onMessage: 接收到消息片段时的回调函数，参数为消息内容字符串
 * onComplete: 对话完成时的回调函数
 * onError: 发生错误时的回调函数，参数为错误对象
 * 返回值: 包含close方法的对象，可用于中断连接
 */
export const aiChatStreamService = (data, onMessage, onComplete, onError) => {
    const baseURL = getBaseURL();
    const authStore = useAuthStore();
    const url = `${baseURL}ai/chat-stream`;
    
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
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        // 读取流式数据
        const readStream = () => {
            reader.read().then(({ done, value }) => {
                if (done) {
                    if (onComplete) onComplete();
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
                            if (onComplete) onComplete();
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
        
        // 返回一个可以用来中断连接的对象
        return {
            close: () => reader.cancel()
        };
    })
    .catch(error => {
        if (onError) onError(error);
    });
};


