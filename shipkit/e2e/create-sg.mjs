// Create (or reuse) the dedicated E2E security group. Touches nothing pre-existing.
import { vpc, VPC_CIDR, MY_IP } from './lib.mjs';

// reuse the one created in a previous partial run, if any
const found = await vpc().DescribeSecurityGroups({
  Filters: [{ Name: 'security-group-name', Values: ['ship-e2e-sg'] }],
});
let sgId = found.SecurityGroupSet?.[0]?.SecurityGroupId;
if (!sgId) {
  const sg = await vpc().CreateSecurityGroup({
    GroupName: 'ship-e2e-sg',
    GroupDescription: 'shipkit E2E temporary security group (delete after validation)',
  });
  sgId = sg.SecurityGroup.SecurityGroupId;
}

const tcp = (port, cidr, desc) => ({ Protocol: 'TCP', Port: String(port), CidrBlock: cidr, Action: 'ACCEPT', PolicyDescription: desc });

await vpc().CreateSecurityGroupPolicies({
  SecurityGroupId: sgId,
  SecurityGroupPolicySet: {
    Ingress: [
      tcp(22, `${MY_IP}/32`, 'ssh from controller'),
      tcp(7410, `${MY_IP}/32`, 'ship-agent api from controller'),
      tcp(7411, `${MY_IP}/32`, 'bootstrap from controller'),
      tcp(7411, VPC_CIDR, 'bootstrap from builder intra-vpc'),
      tcp(5000, VPC_CIDR, 'private registry intra-vpc'),
      tcp(3000, '0.0.0.0/0', 'demo-web http viewable tonight'),
    ],
  },
});

console.log(JSON.stringify({ sgId }, null, 0));
