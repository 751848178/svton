import { access, readFile, readlink } from 'node:fs/promises';

// Record the namespace needed to distinguish a container PID from a host PID.
export async function platformRuntimeContext(dataRoot, files = {}) {
  const context = {};
  try { context.pidNamespace = await readlink(files.pidNamespace ?? '/proc/self/ns/pid'); } catch {}
  try {
    await access(files.containerMarker ?? '/.dockerenv');
    const id = (await readFile(files.hostname ?? '/etc/hostname', 'utf8')).trim();
    if (/^(?:[a-f0-9]{12}|[a-f0-9]{64})$/.test(id)) {
      context.containerId = id;
      context.containerDataRoot = dataRoot;
    }
  } catch {}
  return context;
}
