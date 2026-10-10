// One rendering owner for runtime restrictions in both Compose formats.
import type { RuntimePolicy } from '../shared/runtime-policy-types.js';
import { validateRuntimePolicy } from '../shared/runtime-policy.js';

export function renderRuntimePolicy(runtime: RuntimePolicy | undefined): string[] {
  if (runtime === undefined) return [];
  const policy = validateRuntimePolicy(runtime);
  const lines: string[] = [];
  if (policy.readOnlyRoot) lines.push('    read_only: true');
  if (policy.dropCapabilities) lines.push('    cap_drop:', '      - "ALL"');
  if (policy.noNewPrivileges) lines.push('    security_opt:', '      - "no-new-privileges:true"');
  if (policy.stopGracePeriodSeconds !== undefined) lines.push(`    stop_grace_period: ${policy.stopGracePeriodSeconds}s`);
  if (policy.tmpfs?.length) {
    lines.push('    tmpfs:');
    for (const mount of policy.tmpfs) {
      const options = `uid=${mount.uid},gid=${mount.gid},mode=${mount.mode},size=${mount.sizeMiB}m,noexec,nosuid,nodev`;
      lines.push(`      - ${JSON.stringify(`${mount.target}:${options}`)}`);
    }
  }
  return lines;
}
