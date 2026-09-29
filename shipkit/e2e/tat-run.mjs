// Provision the runtime machine via TAT (Tencent Cloud Automation Tools) — no SSH needed.
// Stage 1-2: push files as base64; stage 3: run provisioning script.
import { readFile } from 'node:fs/promises';

const TAT_VERSION = '2020-04-01';
const INSTANCE_ID = 'ins-hoxlzr4w';
const RT_TOKEN = (await readFile('/tmp/e2e/rt-token.txt', 'utf8')).trim();

const { call } = await import('./rawapi.mjs');

async function runStage(content, description) {
  const res = await call('tat', TAT_VERSION, 'RunCommand', {
    InstanceIds: [INSTANCE_ID],
    Type: 'SHELL',
    Content: Buffer.from(content, 'utf8').toString('base64'),
    WorkingDirectory: '/root',
    Timeout: 900,
    Description: description,
  });
  const invocationId = res.InvocationId;
  console.log(`[${description}] invocation=${invocationId}`);
  for (;;) {
    const r = await call('tat', TAT_VERSION, 'DescribeInvocations', { InvocationIds: [invocationId] });
    const inv = r.InvocationSet?.[0];
    const task = inv?.InvocationTaskSet?.[0];
    const status = inv?.InvocationBasic?.InvocationStatus ?? task?.TaskStatus ?? 'PENDING';
    if (['RUN_SUCCESS', 'RUN_FAILED', 'TASK_TIMEOUT', 'TERMINATED', 'TIMEOUT'].includes(status)) {
      const output = Buffer.from(task?.Output ?? '', 'base64').toString('utf8');
      console.log(`[${description}] ${status} exit=${task?.ExitCode ?? '?'} output-tail:`);
      console.log(output.split('\n').slice(-14).join('\n'));
      if (status !== 'RUN_SUCCESS') process.exit(1);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }
}

// stage 1: agent bundle
const agentTgz = await readFile('/tmp/e2e/agent.tgz');
await runStage(`echo ${agentTgz.toString('base64')} | base64 -d > /tmp/agent.tgz && ls -la /tmp/agent.tgz`, 'push-agent-tgz');

// stage 2: installers
const installSh = await readFile('bootstrap/install.sh', 'utf8');
const builderSh = await readFile('/tmp/e2e/builder-install.sh', 'utf8');
await runStage(
  `echo ${Buffer.from(installSh).toString('base64')} | base64 -d > /tmp/install.sh\n` +
    `echo ${Buffer.from(builderSh).toString('base64')} | base64 -d > /tmp/builder-install.sh\n` +
    `wc -c /tmp/install.sh /tmp/builder-install.sh`,
  'push-installers',
);

// stage 3: provision (daemon.json -> install.sh -> registry -> bootstrap http server)
const provision = `#!/usr/bin/env bash
set -euo pipefail
PRIV=172.16.48.10
mkdir -p /etc/docker
printf '{"registry-mirrors":["https://mirror.ccs.tencentyun.com"],"insecure-registries":["%s:5000"]}\\n' "$PRIV" > /etc/docker/daemon.json
ROLE=runtime AGENT_TOKEN=${RT_TOKEN} AGENT_PORT=7410 TARBALL=/tmp/agent.tgz bash /tmp/install.sh
docker run -d --name ship-registry --restart=always -p 5000:5000 registry:2
mkdir -p /opt/ship-bundle
cp /tmp/builder-install.sh /opt/ship-bundle/install.sh
cp /tmp/agent.tgz /opt/ship-bundle/agent.tgz
nohup python3 -m http.server 7411 --directory /opt/ship-bundle > /var/log/ship-bundle-http.log 2>&1 &
sleep 2
echo "bundle-head: $(curl -sf http://127.0.0.1:7411/install.sh | head -1)"
echo "agent-health: $(curl -sf http://127.0.0.1:7410/health)"
echo "registry-status: $(docker ps --filter name=ship-registry --format '{{.Status}}')"
echo DONE-ALL`;
await runStage(provision, 'provision-runtime');
console.log('runtime provisioning complete');
