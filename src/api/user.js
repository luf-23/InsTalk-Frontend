import request from "@/util/request";


/*
@Data
public class UserInfoVO {
    private Long id;
    private String username;
    private String signature;
    private String avatar;
}
*/
// 获取用户信息params传{id:xxx} 除了自己之外的用户信息
export const getUserInfoService = (params) => {
    return request({
        url: '/user/info',
        method: 'get',
        params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
};

// 需要修改什么就添加什么
//示例1：{signature: "新的个性签名", avatar: "新的头像URL"}
//示例2：{username: "新的用户名"}
//示例3：{email: "新的邮箱"}
export const updateUserInfoService = (data) => {
    return request({
        url: '/user/update',
        method: 'post',
        data,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};
