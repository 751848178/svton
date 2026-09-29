// E2E helper: probe Tencent Cloud regions/VPC/images/instance types (read-only).
// usage: node probe-tencent.mjs scan | node probe-tencent.mjs detail <region>
import cvmPkg from 'tencentcloud-sdk-nodejs-cvm';
import vpcPkg from 'tencentcloud-sdk-nodejs-vpc';

const { Client: CvmClient } = cvmPkg.cvm.v20170312;
const { Client: VpcClient } = vpcPkg.vpc.v20170312;
const cred = { secretId: process.env.TENCENTCLOUD_SECRET_ID, secretKey: process.env.TENCENTCLOUD_SECRET_KEY };
const mkCvm = (region) => new CvmClient({ credential: cred, region });
const mkVpc = (region) => new VpcClient({ credential: cred, region });
const mode = process.argv[2] ?? 'scan';

if (mode === 'scan') {
  const regions = ['ap-guangzhou', 'ap-shanghai', 'ap-beijing', 'ap-nanjing', 'ap-chengdu', 'ap-chongqing', 'ap-hongkong'];
  for (const region of regions) {
    try {
      const cvm = mkCvm(region);
      const zones = await cvm.DescribeZones({});
      const vpc = mkVpc(region);
      const vpcs = await vpc.DescribeVpcs({ Filters: [{ Name: "is-default", Values: ["true"] }], Limit: "5" });
      const vpcIds = (vpcs.VpcSet ?? []).map((v) => v.VpcId).join(',') || 'NONE';
      console.log(`OK   ${region} zones=${zones.ZoneSet?.length ?? 0} defaultVpc=${vpcIds}`);
    } catch (e) {
      console.log(`FAIL ${region} ${(e && e.code) || ''} ${String(e && e.message).slice(0, 90)}`);
    }
  }
} else {
  const region = process.argv[3];
  const cvm = mkCvm(region);
  const vpc = mkVpc(region);
  const vpcs = await vpc.DescribeVpcs({ Filters: [{ Name: "is-default", Values: ["true"] }], Limit: "5" });
  for (const v of vpcs.VpcSet ?? []) {
    console.log(`VPC ${v.VpcId} cidr=${v.CidrBlock}`);
    const subnets = await vpc.DescribeSubnets({ Filters: [{ Name: "vpc-id", Values: [v.VpcId] }], Limit: "20" });
    for (const s of subnets.SubnetSet ?? []) console.log(`  SUBNET ${s.SubnetId} zone=${s.Zone} cidr=${s.CidrBlock}`);
  }
  const images = await cvm.DescribeImages({
    Filters: [
      { Name: 'image-type', Values: ['PUBLIC_IMAGE'] },
      { Name: 'image-name', Values: ['Ubuntu Server 22.04'] },
    ],
    Limit: 20,
  });
  for (const i of images.ImageSet ?? []) {
    console.log(`IMAGE ${i.ImageId} ${i.ImageName} size=${i.ImageSize}GB state=${i.ImageState}`);
  }
  const cfgs = await cvm.DescribeZoneInstanceConfigInfos({});
  const wanted = ['S5.MEDIUM2', 'SA2.MEDIUM2', 'S6.MEDIUM2', 'SA5.MEDIUM2', 'C3.MEDIUM2', 'S5.MEDIUM4'];
  for (const c of cfgs.InstanceTypeQuotaSet ?? []) {
    if (wanted.includes(c.InstanceType ?? '') && (c.Status ?? '') === 'SELL') {
      console.log(`TYPE ${c.Zone} ${c.InstanceType} cpu=${c.Cpu} mem=${c.Memory}GB`);
    }
  }
}
