import request from "@/util/request";

export const getOssCredentialsService = () => {
    return request({
        url: '/oss/credentials',
        method: 'get',
    });
};

export const getOssBucketService = () => {
    return request({
        url: '/oss/bucket',
        method: 'get',
    });
};

export const getOssRegionService = () => {
    return request({
        url: '/oss/region',
        method: 'get',
    });
};


export const getOssEndpointService = () => {
    return request({
        url: '/oss/endpoint',
        method: 'get',
    });
}
