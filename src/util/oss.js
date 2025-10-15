import OSS from "ali-oss";

import {
    getOssCredentialsService,
    getOssBucketService,
    getOssEndpointService,
} from "@/api/oss";

export class OSSClient {

  constructor() {
    this.client = null;
    this.STS = {
      credentials: [],
      bucket: "",
      endPoint: ""
    };
  }

  async init() {
    const credentials = await getOssCredentialsService();
    const bucket = await getOssBucketService();
    const endPoint = await getOssEndpointService();

    this.STS.credentials = credentials;
    this.STS.bucket = bucket;
    this.STS.endPoint = endPoint;

    this.client = new OSS({
      endpoint: this.STS.endPoint,
      accessKeyId: this.STS.credentials.accessKeyId,
      accessKeySecret: this.STS.credentials.accessKeySecret,
      stsToken: this.STS.credentials.securityToken,
      bucket: this.STS.bucket
    });
  }

  generateFileUrl(fileName) {
    return `https://${this.STS.bucket}.${this.STS.endPoint}/${fileName}`;
  }

  generateFileName(extension){
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000);
    return `ins_talk/${timestamp}_${randomNum}.${extension}`;
  }

  async uploadFile(fileName, file) {
    if (!this.client) {
      throw new Error("OSS client not initialized");
    }
    return await this.client.put(fileName, file);
  }
}

export const ossClient = new OSSClient();
