import request from "@/util/request";

export const createGroupService = (data) => {
    return request({
        url: '/group/create',
        method: 'post',
        data,
        headers: {
            'Content-Type': 'application/json',
        },
    });
};

//params传{groupId:groupId}
export const joinGroupService = (params) => {
    return request({
        url: '/group/join',
        method: 'post',
        params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
};

/*
@Data
public class GroupVO {
    private Long id;
    private String name;
    private String description;
    private String avatar;
    private Long ownerId;
    private LocalDateTime createdAt;
    private List<Long> adminIds;
    private List<Member> members;
    @Data
    public static class Member{
        private Long id;
        private String username;
        private String nickname;
        private String avatar;
    }
}
*/
// 获取所有我已加入的群组列表（包含成员信息）
export const getGroupListWithMembersService = () => {
    return request({
        url: '/group/groupList',
        method: 'get'
    });
};


/*
@Data
public class GroupVO {
    private Long id;
    private String name;
    private String description;
    private String avatar;
    private Long ownerId;
    private LocalDateTime createdAt;
    private List<Long> adminIds;
    private List<Member> members;
    @Data
    public static class Member{
        private Long id;
        private String username;
        private String nickname;
        private String avatar;
    }
}
*/
// 获取我创建的群组列表（包含成员信息）
export const getMyGroupListWithMembersService = () => {
    return request({
        url: '/group/myGroupList',
        method: 'get'
    });
};



//params传{name:xxx} 支持模糊搜索
/*
@Data
public class GroupVO {
    private Long id;
    private String name;
    private String description;
    private String avatar;
    private Long ownerId;
    private LocalDateTime createdAt;
    private List<Long> adminIds;
    private List<Member> members;
    @Data
    public static class Member{
        private Long id;
        private String username;
        private String nickname;
        private String avatar;
    }
}
*/
export const searchGroupByNameService = (params) => {
    return request({
        url: '/group/search',
        method: 'get',
        params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
}