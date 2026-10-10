// Inspect immutable LFS metadata with bounded NUL-separated candidates and no stdout logs.
import type { GitCommand } from './git-command-types.js';

const MAX_BYTES = 1024 * 1024;
const MAX_CANDIDATES = 128;
const POINTER_VERSION = /^version (?:https:\/\/(?:git-lfs|hawser)[.]github[.]com\/spec\/v1|http:\/\/git-media[.]io\/v\/2)$/;

function isPointer(content: string): boolean {
  if (Buffer.byteLength(content) >= 1024) return false;
  // Match the actual decoder's TrimSpace/blank-line tolerance, not only canonical encoding.
  const lines = content.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '').split(/\r?\n/)
    .filter(line => line !== '' && !/^ext-[0-9]-\w\S* .*$/.test(line));
  if (lines.length !== 3) return false;
  if (!POINTER_VERSION.test(lines[0] ?? '')) return false;
  const size = /^size ([+-]?[0-9]+)$/.exec(lines[2] ?? '')?.[1];
  return /^oid sha256:[a-f0-9]{64}$/.test(lines[1] ?? '') && size !== undefined
    && BigInt(size) >= 0n && BigInt(size) <= 9223372036854775807n;
}

function hasLfsAttribute(content: string): boolean {
  return content.split(/\r?\n/).some(line => {
    const trimmed = line.trimStart();
    if (!trimmed || trimmed.startsWith('#')) return false;
    // The first token is a pattern (possibly C-quoted), never an attribute.
    const pattern = /^(?:"(?:[^"\\]|\\.)*"|[^\s]+)\s+(.*)$/.exec(trimmed);
    return pattern?.[1]?.split(/\s+/).includes('filter=lfs') ?? false;
  });
}

export async function assertNoGitLfs(git: GitCommand, dir: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  let bytes = 0;
  const metadata = async (args: string[], allowNoMatch = false): Promise<string> => {
    const timeoutMs = deadline - Date.now();
    if (timeoutMs <= 0) throw new Error('Git LFS support check failed (timeout)');
    const result = await git.run(['-C', dir, ...args], timeoutMs, { logStdout: false });
    bytes += Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr);
    if (result.timedOut || result.truncated || bytes > MAX_BYTES || (result.code !== 0 && !(allowNoMatch && result.code === 1))) {
      throw new Error('Git LFS support check failed (command, timeout or bounded capture limit)');
    }
    if (result.code === 1 && result.stdout) throw new Error('Git LFS support check returned unexpected metadata');
    return result.stdout;
  };
  const candidates = new Map<string, { pointer: boolean; attribute: boolean }>();
  const collect = (output: string, kind: 'pointer' | 'attribute') => {
    if (!output) return;
    if (!output.endsWith('\0')) throw new Error('Git LFS support check returned invalid NUL metadata');
    for (const object of output.slice(0, -1).split('\0')) {
      if (!object.startsWith('HEAD:') || object.length <= 5) throw new Error('Git LFS support check returned unexpected candidate');
      const file = object.slice(5);
      if (kind === 'attribute' && file.split('/').at(-1) !== '.gitattributes') throw new Error('Git LFS support check returned an unrelated attribute file');
      const candidate = candidates.get(object) ?? { pointer: false, attribute: false };
      candidate[kind] = true; candidates.set(object, candidate);
      if (candidates.size > MAX_CANDIDATES) throw new Error('Git LFS support check exceeded the candidate limit');
    }
  };
  collect(await metadata(['grep', '-I', '-l', '-z', '-E', 'version (https://(git-lfs|hawser)[.]github[.]com/spec/v1|http://git-media[.]io/v/2)', 'HEAD', '--'], true), 'pointer');
  collect(await metadata(['grep', '-I', '-l', '-z', '-E', '(^|[[:space:]])filter=lfs([[:space:]]|$)', 'HEAD', '--', ':(glob)**/.gitattributes', '.gitattributes'], true), 'attribute');
  for (const [object, candidate] of candidates) {
    const content = await metadata(['show', object]);
    if ((candidate.pointer && isPointer(content)) || (candidate.attribute && hasLfsAttribute(content))) {
      throw new Error('Git LFS is not supported in this release; commit ordinary files');
    }
  }
}
