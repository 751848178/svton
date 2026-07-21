import type { IPlatform } from '@svton/agent-platform';
import { shellQuote } from '../utils/shell-quote.utils';

export interface GitSkillContentResult {
  content?: string;
  error?: string;
}

export async function readGitSkillContent(
  platform: IPlatform | undefined,
  repo: string,
  ref?: string,
): Promise<GitSkillContentResult> {
  if (!platform?.process) {
    return { error: 'Git installation requires desktop (process access)' };
  }

  try {
    const archiveRef = ref || 'HEAD';
    const { stdout, exitCode } = await platform.process.exec(
      `git archive --remote=${shellQuote(repo)} ${shellQuote(archiveRef)} SKILL.md 2>/dev/null | tar -xO`,
      { timeout: 30000 },
    );
    if (exitCode === 0 && stdout.trim()) return { content: stdout };
    return await readGitSkillContentFallback(platform, repo, ref);
  } catch {
    return await readGitSkillContentFallback(platform, repo, ref);
  }
}

async function readGitSkillContentFallback(
  platform: IPlatform,
  repo: string,
  ref?: string,
): Promise<GitSkillContentResult> {
  if (!platform.process || !platform.fs) {
    return { error: 'Git installation requires desktop' };
  }

  const tmpDir = `/tmp/svton-skill-${Date.now()}`;
  try {
    const cloneCmd = ref
      ? `git clone --depth 1 --branch ${shellQuote(ref)} ${shellQuote(repo)} ${shellQuote(tmpDir)}`
      : `git clone --depth 1 ${shellQuote(repo)} ${shellQuote(tmpDir)}`;
    const { exitCode } = await platform.process.exec(cloneCmd, { timeout: 60000 });
    if (exitCode !== 0) return { error: `git clone failed (exit code ${exitCode})` };

    const content = await findSkillMdInDir(platform, tmpDir);
    return content ? { content } : { error: 'No SKILL.md found in repository' };
  } finally {
    try {
      await platform.process.exec(`rm -rf ${shellQuote(tmpDir)}`, { timeout: 5000 });
    } catch {}
  }
}

async function findSkillMdInDir(platform: IPlatform, dir: string): Promise<string | null> {
  const root = await readIfExists(platform, platform.fs.join(dir, 'SKILL.md'));
  if (root) return root;

  for (const parent of ['.svton', '.claude', '.agents']) {
    const found = await readNestedSkill(platform, platform.fs.join(dir, parent, 'skills'));
    if (found) return found;
  }
  return null;
}

async function readNestedSkill(platform: IPlatform, dir: string): Promise<string | null> {
  try {
    if (!(await platform.fs.exists(dir))) return null;
    const entries = await platform.fs.listDir(dir);
    for (const entry of entries) {
      if (entry.isDirectory) {
        const content = await readIfExists(platform, platform.fs.join(dir, entry.name, 'SKILL.md'));
        if (content) return content;
      }
    }
  } catch {}
  return null;
}

async function readIfExists(platform: IPlatform, path: string): Promise<string | null> {
  try {
    return (await platform.fs.exists(path)) ? await platform.fs.readFile(path) : null;
  } catch {
    return null;
  }
}
