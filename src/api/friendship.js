import request from "@/util/request";

// 发送好友申请(params传{id:id})
export const sendFriendRequestService = (params) => {
    return request({
        url: '/friendship/send',
        method: 'post',
        params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
}

//接受好友申请
/*
@Data
public class FriendVO {
    private Long id;
    private String username;
    private String signature;
    private String role;//ROBOT or USER
    private String avatar;
    private LocalDateTime createdAt;
}
*/
export const acceptFriendRequestService = (params) => {
    return request({
        url: '/friendship/accept',
        method: 'post',
        params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
}

//拒绝好友申请
export const rejectFriendRequestService = (params) => {
    return request({
        url: '/friendship/reject',
        method: 'post',
        params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
}

//删除好友
//prams传{id:对方id}
export const deleteFriendService = (params) => {
    return request({
        url: '/friendship/delete',
        method: 'post',
        params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
}


//获取好友列表
/*
@Data
public class FriendVO {
    private Long id;
    private String username;
    private String signature;
    private String role;//ROBOT or USER
    private String avatar;
    private LocalDateTime createdAt;
}
*/
export const getFriendListService = () => {
    return request({
        url: '/friendship/friendList',
        method: 'get',
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

//获取好友申请列表
/*
@Data
public class FriendVO {
    private Long id;
    private String username;
    private String signature;
    private String role;//ROBOT or USER
    private String avatar;
    private LocalDateTime createdAt;
}
*/
export const getPendingListService = () => {
    return request({
        url: '/friendship/pendingList',
        method: 'get',
        headers: {
            'Content-Type': 'application/json'
        }
    });
}


// 通过用户名搜索用户(支持模糊搜索) params传{username:username}
/*
@Data
public class FriendVO {
    private Long id;
    private String username;
    private String signature;
    private String role;//ROBOT or USER
    private String avatar;
    private LocalDateTime createdAt;
}
*/
export const searchUserByUsernameService = (params) => {
    return request({
        url: '/friendship/search',
        method: 'get',
        params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
};