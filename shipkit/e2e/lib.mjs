// Shared constants + client factories for the Tencent E2E (region probed: ap-guangzhou).
import cvmPkg from 'tencentcloud-sdk-nodejs-cvm';
import vpcPkg from 'tencentcloud-sdk-nodejs-vpc';

export const REGION = 'ap-guangzhou';
export const ZONE = 'ap-guangzhou-6';
export const VPC_ID = 'vpc-ejzyqz2h';
export const SUBNET_ID = 'subnet-nz95566o';
export const IMAGE_ID = 'img-487zeit5'; // Ubuntu Server 22.04 LTS 64bit
export const INSTANCE_TYPE = 'SA5.MEDIUM2'; // cheapest 2C2G in sell
export const VPC_CIDR = '172.16.0.0/16';
export const MY_IP = '103.151.172.35'; // controller public egress IP
export const SERVER_PASSWORD = process.env.SHIP_E2E_PASSWORD ?? (() => { throw new Error('set SHIP_E2E_PASSWORD before running e2e scripts'); })();

const { Client: CvmClient } = cvmPkg.cvm.v20170312;
const { Client: VpcClient } = vpcPkg.vpc.v20170312;

const cred = () => ({
  secretId: process.env.TENCENTCLOUD_SECRET_ID,
  secretKey: process.env.TENCENTCLOUD_SECRET_KEY,
});

export const cvm = () => new CvmClient({ credential: cred(), region: REGION });
export const vpc = () => new VpcClient({ credential: cred(), region: REGION });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
