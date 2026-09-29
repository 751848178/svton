// Create the runtime CVM (minimal, pay-as-you-go) and wait until it has a public IP.
import { cvm, sleep, ZONE, VPC_ID, SUBNET_ID, IMAGE_ID, INSTANCE_TYPE, SERVER_PASSWORD } from './lib.mjs';

const sgId = process.env.SG_ID;
if (!sgId) throw new Error('SG_ID env required (run create-sg.mjs first)');

const run = await cvm().RunInstances({
  Placement: { Zone: ZONE },
  InstanceChargeType: 'POSTPAID_BY_HOUR',
  InstanceType: process.env.TYPE_OVERRIDE || INSTANCE_TYPE,
  ImageId: IMAGE_ID,
  SecurityGroupIds: [sgId],
  VirtualPrivateCloud: { VpcId: VPC_ID, SubnetId: SUBNET_ID },
  InternetAccessible: {
    InternetChargeType: 'TRAFFIC_POSTPAID_BY_HOUR',
    InternetMaxBandwidthOut: 5,
    PublicIpAssigned: true,
  },
  LoginSettings: { Password: SERVER_PASSWORD },
  ...(process.env.DISK_TYPE ? { SystemDisk: { DiskType: process.env.DISK_TYPE, DiskSize: 20 } } : {}),
  InstanceName: 'ship-e2e-runtime',
  InstanceCount: 1,
});
const instanceId = run.InstanceIdSet?.[0];
if (!instanceId) throw new Error(`RunInstances returned no id: ${JSON.stringify(run)}`);
console.log(`instanceId=${instanceId}`);

const deadline = Date.now() + 8 * 60_000;
for (;;) {
  const res = await cvm().DescribeInstances({ InstanceIds: [instanceId] });
  const inst = res.InstanceSet?.[0];
  const status = inst?.InstanceStatus ?? 'PENDING';
  const ip = inst?.PublicIpAddresses?.[0];
  const priv = inst?.PrivateIpAddresses?.[0];
  if (status === 'RUNNING' && ip) {
    console.log(JSON.stringify({ instanceId, publicIp: ip, privateIp: priv }, null, 0));
    break;
  }
  if (status === 'LAUNCH_FAILED') throw new Error('instance launch failed');
  if (Date.now() > deadline) throw new Error(`timeout waiting for instance, status=${status}`);
  console.log(`waiting... status=${status}`);
  await sleep(5000);
}
