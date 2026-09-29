// Set AutoReleaseTime on an instance via the generic request() escape hatch.
// usage: node set-autorelease.mjs <instanceId> <"YYYY-MM-DD HH:mm:ss">  (UTC+8)
import { cvm } from './lib.mjs';

const [instanceId, time] = process.argv.slice(2);
if (!instanceId || !time) throw new Error('usage: set-autorelease.mjs <instanceId> <time>');

let lastErr;
for (const t of [time, time.replace(' ', 'T') + '+08:00']) {
  try {
    await cvm().request('ModifyInstanceAutoReleaseTime', { InstanceIds: [instanceId], AutoReleaseTime: t });
    console.log(`auto-release set: ${instanceId} @ ${t}`);
    process.exit(0);
  } catch (e) {
    lastErr = e;
  }
}
throw lastErr;
