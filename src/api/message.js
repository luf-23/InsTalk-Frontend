import request from "@/util/request";

// 发送消息
// data传{receiverId:xxx,groupId:xxx,content:xxx,messageType:xxx}
// messageType: 'TEXT' | 'IMAGE' | 'FILE'
// receiverId和groupId二选一
/*
@Data
public class MessageVO {
    private Long id;
    private Long senderId;
    private Long receiverId;
    private Long groupId;
    private String content;
    private String messageType;
    private LocalDateTime sentAt;
    private Boolean isRead;
}
*/
export const sendMessageService = (data) => {
    return request({
        url: '/message/send',
        method: 'POST',
        data,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};

// 获取历史消息
/*
@Data
public class MessageVO {
    private Long id;
    private Long senderId;
    private Long receiverId;
    private Long groupId;
    private String content;
    private String messageType;
    private LocalDateTime sentAt;
    private Boolean isRead;
    //1.senderId为自己
    //2.receiverId为自己
    //3.groupId群成员有自己且senderId不为自己
}
*/
export const getMessageHistoryService = () => {
    return request({
        url: '/message/messageList',
        method: 'GET',
    });
};


// 获取新消息(data传lastMessage对象)
/*
@Data
public class MessageVO {
    private Long id;
    private Long senderId;
    private Long receiverId;
    private Long groupId;
    private String content;
    private String messageType;
    private LocalDateTime sentAt;
    private Boolean isRead;
    //1.senderId为自己
    //2.receiverId为自己
    //3.groupId群成员有自己且senderId不为自己
}
*/
export const getNewMessagesService = (data = {}) => {
    // 如果未提供 lastMessage，则传空对象，避免将 null 直接发给后端导致解析错误
    return request({
        url: '/message/newMessageList',
        method: 'POST',
        data,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};


// 标记消息为已读(params传messageId)
export const markMessageAsReadService = (params) => {
    return request({
        url: '/message/read',
        method: 'POST',
        params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
};


// 批量标记消息为已读(params传messageIds)
export const markMessageListAsReadService = (params) => {
    return request({
        url: '/message/readList',
        method: 'POST',
        params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
};

// 撤回消息(params传messageId)
export const revokeMessageService = (params) => {
    return request({
        url: '/message/revoke',
        method: 'POST',
        params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
};

// 删除消息(params传messageId) - 客户端本地删除
export const deleteMessageService = (messageId) => {
    // 注意: 这是客户端本地删除，不调用后端API
    // 实际业务中可能需要调用后端API来删除
    return Promise.resolve({ success: true, messageId });
};

// 转发消息(data传{messageId, receiverId?, groupId?})
export const forwardMessageService = (data) => {
    // 注意: 后端可能没有专门的转发接口
    // 这里直接使用发送消息接口来实现转发
    return request({
        url: '/message/send',
        method: 'POST',
        data,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};
