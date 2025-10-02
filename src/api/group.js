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
    private Long ownerId;
    private LocalDateTime createdAt;
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
export const getGroupListWithMembersService = () => {
    return request({
        url: '/group/groupList',
        method: 'get'
    });
};

export const getMyGroupListWithMembersService = () => {
    return request({
        url: '/group/myGroupList',
        method: 'get'
    });
};