import { createHmac, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { PrivateProjectSnapshot } from './private-snapshot.js';
import type { RuntimeConfigMode } from '../shared/group-protocol.js';
import { assertCloudCredentialTrust } from './cloud-credential-trust.js';
import { isRuntimeOnly } from './execution-kind.js';

export function snapshotFingerprint(snapshot: PrivateProjectSnapshot, mode: 'git' | 'directory', keepEnv: boolean, configMode?: RuntimeConfigMode) {
  const secretDigest = createHmac('sha256', snapshot.runtime.token).update(JSON.stringify(snapshot.envFiles))
    .update(JSON.stringify(snapshot.noEnvServices ?? [])).update(JSON.stringify(snapshot.config))
    .update(JSON.stringify(snapshot.cloudCredentialDigests ?? {})).digest('hex');
  return createHash('sha256').update(JSON.stringify({ spec: snapshot.spec, identity: snapshot.identity, target: snapshot.targetKey,
    source: snapshot.sourceSnapshot ?? snapshot.gitRef ?? snapshot.sourceDigest, configDigest: snapshot.configDigest,
    configRefs: snapshot.configRefs, configFingerprint: snapshot.configFingerprint, secretDigest, mode, keepEnv, configMode, executionKind: snapshot.executionKind })).digest('hex');
}
export async function assertSnapshotTrust(snapshot: PrivateProjectSnapshot): Promise<void> {
  if (!isRuntimeOnly(snapshot.executionKind)) assertCloudCredentialTrust(snapshot.config, snapshot.cloudCredentialDigests);
  for (const [file, expected] of Object.entries(snapshot.caDigests ?? {})) {
    const actual = await readFile(file).catch(() => undefined);
    if (!actual || createHash('sha256').update(actual).digest('hex') !== expected) throw new Error('Saved TLS CA reference changed; restore the original trust material before observing or executing this task');
  }
}
