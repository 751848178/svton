// Terminate the E2E instances (safe: only ever called with explicit ids of machines we created).
// usage: node terminate-all.mjs <instanceId> [moreIds...]
import { cvm } from './lib.mjs';

const ids = process.argv.slice(2).filter(Boolean);
if (ids.length === 0) throw new Error('no instance ids given');
await cvm().TerminateInstances({ InstanceIds: ids });
console.log(`terminated: ${ids.join(', ')}`);
const res = await cvm().DescribeInstances({ InstanceIds: ids });
for (const i of res.InstanceSet ?? []) {
  console.log(`${i.InstanceId} -> ${i.InstanceStatus}`);
}
