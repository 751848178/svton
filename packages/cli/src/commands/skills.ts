import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import ora from 'ora';
import os from 'os';
import path from 'path';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

const DEFAULT_OUT_DIR = '.svton/skills';
const DEFAULT_SKILL_HUB = 'https://skills.sh';
const STANDARD_RESOURCE_DIRS = ['references', 'scripts', 'assets', 'agents'];

export interface SkillInstallOptions {
  sourceDir?: string;
  repo?: string;
  ref?: string;
  url?: string;
  hub?: string;
  skill?: string;
  outDir?: string;
  force?: boolean;
  yes?: boolean;
}

export interface SkillBuildOptions {
  skillsDir?: string;
  outDir?: string;
  clean?: boolean;
}

export interface SkillListOptions {
  outDir?: string;
}

type InstallKind = 'local' | 'git' | 'url' | 'hub';

interface InstallRequest {
  kind: InstallKind;
  sourceDir?: string;
  repo?: string;
  ref?: string;
  url?: string;
  hub?: string;
  skillId?: string;
  outDir: string;
  force: boolean;
}

interface BuildResult {
  name: string;
  sourceDir: string;
  targetDir: string;
}

interface RemoteSkillFile {
  path: string;
  contents?: string;
  content?: string;
}

export async function installSkill(source?: string, options: SkillInstallOptions = {}) {
  try {
    const request = await resolveInstallRequest(source, options);
    const spinner = ora(`Installing skill into ${request.outDir}...`).start();

    try {
      const results = await installFromRequest(request);
      spinner.succeed(`Installed ${results.length} skill${results.length === 1 ? '' : 's'}`);
      printResults(results);
    } catch (error) {
      spinner.fail('Skill install failed');
      throw error;
    }
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export async function buildSkills(skillName?: string, options: SkillBuildOptions = {}) {
  try {
    const skillsDir = path.resolve(process.cwd(), options.skillsDir || 'skills');
    const outDir = path.resolve(process.cwd(), options.outDir || DEFAULT_OUT_DIR);

    if (!(await fs.pathExists(skillsDir))) {
      throw new Error(`Skills directory not found: ${skillsDir}`);
    }

    const spinner = ora(`Building skills from ${skillsDir}...`).start();
    try {
      if (options.clean) {
        await fs.remove(outDir);
      }

      const sourceDirs = skillName
        ? [resolveSkillSourceDir(skillsDir, skillName)]
        : await discoverSkillDirs(skillsDir);

      if (sourceDirs.length === 0) {
        throw new Error(`No skills found in ${skillsDir}`);
      }

      const results: BuildResult[] = [];
      for (const sourceDir of sourceDirs) {
        results.push(await buildSkillDirectory(sourceDir, outDir, { overwrite: true }));
      }

      spinner.succeed(`Built ${results.length} skill${results.length === 1 ? '' : 's'}`);
      printResults(results);
    } catch (error) {
      spinner.fail('Skill build failed');
      throw error;
    }
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export async function listSkills(options: SkillListOptions = {}) {
  try {
    const outDir = path.resolve(process.cwd(), options.outDir || DEFAULT_OUT_DIR);
    if (!(await fs.pathExists(outDir))) {
      logger.warn(`No skill directory found at ${outDir}`);
      return;
    }

    const sourceDirs = await discoverSkillDirs(outDir);
    if (sourceDirs.length === 0) {
      logger.warn(`No skills found in ${outDir}`);
      return;
    }

    logger.info(chalk.cyan(`Skills in ${outDir}:`));
    for (const sourceDir of sourceDirs) {
      const skill = await readSkillIdentity(sourceDir);
      logger.info(`  ${chalk.white(skill.name)} - ${skill.description}`);
    }
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function resolveInstallRequest(
  source: string | undefined,
  options: SkillInstallOptions,
): Promise<InstallRequest> {
  const hasCommandInput = Boolean(
    source || options.sourceDir || options.repo || options.url || options.hub || options.skill,
  );

  if (!hasCommandInput && !options.yes && process.stdin.isTTY) {
    return promptInstallRequest(options);
  }

  const outDir = path.resolve(process.cwd(), options.outDir || DEFAULT_OUT_DIR);
  const force = Boolean(options.force);

  if (options.repo) {
    return {
      kind: 'git',
      repo: options.repo,
      ref: options.ref,
      sourceDir: options.sourceDir,
      outDir,
      force,
    };
  }

  if (options.hub || options.skill) {
    const skillId = options.skill || source;
    if (!skillId) {
      throw new Error('Missing skill id. Use --skill <owner/repo/skill> with --hub.');
    }
    return {
      kind: 'hub',
      hub: options.hub || DEFAULT_SKILL_HUB,
      skillId,
      outDir,
      force,
    };
  }

  if (options.url) {
    return { kind: 'url', url: options.url, outDir, force };
  }

  if (options.sourceDir) {
    return {
      kind: 'local',
      sourceDir: path.resolve(process.cwd(), options.sourceDir),
      outDir,
      force,
    };
  }

  if (!source) {
    throw new Error('Missing skill source. Use --source-dir, --repo, --url, or --hub/--skill.');
  }

  if (isHttpUrl(source)) {
    if (looksLikeGitRepo(source)) {
      return { kind: 'git', repo: source, ref: options.ref, outDir, force };
    }
    return { kind: 'url', url: source, outDir, force };
  }

  return {
    kind: 'local',
    sourceDir: path.resolve(process.cwd(), source),
    outDir,
    force,
  };
}

async function promptInstallRequest(options: SkillInstallOptions): Promise<InstallRequest> {
  const first = await inquirer.prompt([
    {
      type: 'list',
      name: 'kind',
      message: 'Install skill from:',
      choices: [
        { name: 'Local source directory', value: 'local' },
        { name: 'Git repository', value: 'git' },
        { name: 'Direct SKILL.md URL', value: 'url' },
        { name: 'SkillHub / skills.sh', value: 'hub' },
      ],
    },
  ]);

  const common = await inquirer.prompt([
    {
      type: 'input',
      name: 'outDir',
      message: 'Install into:',
      default: options.outDir || DEFAULT_OUT_DIR,
    },
    {
      type: 'confirm',
      name: 'force',
      message: 'Overwrite existing skill with the same name?',
      default: Boolean(options.force),
    },
  ]);

  if (first.kind === 'local') {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'sourceDir',
        message: 'Source directory:',
        default: options.sourceDir || 'skills',
        validate: (value: string) => value.trim() ? true : 'Source directory is required',
      },
    ]);

    return {
      kind: 'local',
      sourceDir: path.resolve(process.cwd(), answers.sourceDir),
      outDir: path.resolve(process.cwd(), common.outDir),
      force: common.force,
    };
  }

  if (first.kind === 'git') {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'repo',
        message: 'Git repository URL:',
        default: options.repo,
        validate: (value: string) => value.trim() ? true : 'Git repository URL is required',
      },
      {
        type: 'input',
        name: 'ref',
        message: 'Branch/tag/ref (optional):',
        default: options.ref,
      },
      {
        type: 'input',
        name: 'sourceDir',
        message: 'Skill source directory inside the repo:',
        default: options.sourceDir || '.',
      },
    ]);

    return {
      kind: 'git',
      repo: answers.repo,
      ref: answers.ref,
      sourceDir: answers.sourceDir,
      outDir: path.resolve(process.cwd(), common.outDir),
      force: common.force,
    };
  }

  if (first.kind === 'hub') {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'hub',
        message: 'SkillHub base URL:',
        default: options.hub || DEFAULT_SKILL_HUB,
      },
      {
        type: 'input',
        name: 'skillId',
        message: 'Skill id:',
        default: options.skill,
        validate: (value: string) => value.trim() ? true : 'Skill id is required',
      },
    ]);

    return {
      kind: 'hub',
      hub: answers.hub,
      skillId: answers.skillId,
      outDir: path.resolve(process.cwd(), common.outDir),
      force: common.force,
    };
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'SKILL.md URL:',
      default: options.url,
      validate: (value: string) => isHttpUrl(value) ? true : 'A valid http(s) URL is required',
    },
  ]);

  return {
    kind: 'url',
    url: answers.url,
    outDir: path.resolve(process.cwd(), common.outDir),
    force: common.force,
  };
}

async function installFromRequest(request: InstallRequest): Promise<BuildResult[]> {
  if (request.kind === 'local') {
    if (!request.sourceDir) throw new Error('Missing source directory');
    return installFromLocalSource(request.sourceDir, request.outDir, request.force);
  }

  if (request.kind === 'url') {
    if (!request.url) throw new Error('Missing SKILL.md URL');
    const content = await fetchText(request.url);
    return installFromContent(content, request.outDir, request.force, request.url);
  }

  if (request.kind === 'hub') {
    if (!request.hub || !request.skillId) throw new Error('Missing SkillHub URL or skill id');
    return installFromSkillHub(request.hub, request.skillId, request.outDir, request.force);
  }

  if (!request.repo) throw new Error('Missing Git repository URL');
  return installFromGitRepository(request);
}

async function installFromLocalSource(
  sourceDir: string,
  outDir: string,
  force: boolean,
): Promise<BuildResult[]> {
  if (!(await fs.pathExists(sourceDir))) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  const sourceDirs = await discoverSkillDirs(sourceDir);
  if (sourceDirs.length === 0) {
    throw new Error(`No SKILL.md found in ${sourceDir}`);
  }

  const results: BuildResult[] = [];
  for (const dir of sourceDirs) {
    results.push(await buildSkillDirectory(dir, outDir, { overwrite: force }));
  }
  return results;
}

async function installFromContent(
  content: string,
  outDir: string,
  force: boolean,
  sourceLabel: string,
): Promise<BuildResult[]> {
  const skill = parseSkillMarkdown(content);
  validateSkillIdentity(skill, sourceLabel);

  const targetDir = path.join(outDir, skill.name);
  await prepareTargetDir(targetDir, force);
  await fs.ensureDir(targetDir);
  await fs.writeFile(path.join(targetDir, 'SKILL.md'), normalizeLines(content));

  return [{ name: skill.name, sourceDir: sourceLabel, targetDir }];
}

async function installFromSkillHub(
  hub: string,
  skillId: string,
  outDir: string,
  force: boolean,
): Promise<BuildResult[]> {
  const detailUrl = `${trimTrailingSlash(hub)}/api/v1/skills/${skillId.replace(/^\/+/, '')}`;
  const resp = await fetch(detailUrl);
  if (!resp.ok) {
    throw new Error(`SkillHub request failed: HTTP ${resp.status} ${resp.statusText}`);
  }

  const detail = await resp.json();
  const files = extractRemoteFiles(detail);
  if (files.length === 0) {
    throw new Error(`SkillHub response did not contain downloadable files: ${detailUrl}`);
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'svton-skillhub-'));
  try {
    for (const file of files) {
      const contents = file.contents ?? file.content;
      if (typeof contents !== 'string') continue;
      const filePath = safeJoin(tempDir, file.path);
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, contents);
    }

    return await installFromLocalSource(tempDir, outDir, force);
  } finally {
    await fs.remove(tempDir);
  }
}

async function installFromGitRepository(request: InstallRequest): Promise<BuildResult[]> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'svton-skill-git-'));
  const args = ['clone', '--depth', '1'];

  if (request.ref) {
    args.push('--branch', request.ref);
  }

  args.push(request.repo!, tempDir);

  try {
    await execFileAsync('git', args, { maxBuffer: 1024 * 1024 * 10 });
    const sourceRoot = path.resolve(tempDir, request.sourceDir || '.');
    return await installFromLocalSource(sourceRoot, request.outDir, request.force);
  } finally {
    await fs.remove(tempDir);
  }
}

async function discoverSkillDirs(rootDir: string): Promise<string[]> {
  if (await hasSkillSource(rootDir)) {
    return [rootDir];
  }

  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const dirs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = path.join(rootDir, entry.name);
    if (await hasSkillSource(child)) {
      dirs.push(child);
    }
  }

  return dirs.sort();
}

async function hasSkillSource(dir: string): Promise<boolean> {
  return fs.pathExists(path.join(dir, 'SKILL.md'));
}

function resolveSkillSourceDir(skillsDir: string, skillName: string): string {
  if (path.isAbsolute(skillName) || skillName.includes('/') || skillName.includes('\\')) {
    return path.resolve(process.cwd(), skillName);
  }
  return path.join(skillsDir, skillName);
}

async function buildSkillDirectory(
  sourceDir: string,
  outDir: string,
  options: { overwrite: boolean },
): Promise<BuildResult> {
  if (!(await fs.pathExists(sourceDir))) {
    throw new Error(`Skill source not found: ${sourceDir}`);
  }

  const identity = await readSkillIdentity(sourceDir);

  validateSkillIdentity(identity, sourceDir);

  const targetDir = path.join(outDir, identity.name);
  await prepareTargetDir(targetDir, options.overwrite);
  await fs.ensureDir(targetDir);
  await fs.copy(path.join(sourceDir, 'SKILL.md'), path.join(targetDir, 'SKILL.md'));
  await copyResourceDirs(sourceDir, targetDir);

  return {
    name: identity.name,
    sourceDir,
    targetDir,
  };
}

async function prepareTargetDir(targetDir: string, overwrite: boolean) {
  if (await fs.pathExists(targetDir)) {
    if (!overwrite) {
      throw new Error(`Skill already exists at ${targetDir}. Re-run with --force to overwrite.`);
    }
    await fs.remove(targetDir);
  }
}

async function copyResourceDirs(sourceDir: string, targetDir: string) {
  for (const dirName of STANDARD_RESOURCE_DIRS) {
    const from = path.join(sourceDir, dirName);
    if (await fs.pathExists(from)) {
      await fs.copy(from, path.join(targetDir, dirName));
    }
  }
}

async function readSkillIdentity(sourceDir: string): Promise<{ name: string; description: string }> {
  const skillMdPath = path.join(sourceDir, 'SKILL.md');
  if (!(await fs.pathExists(skillMdPath))) {
    throw new Error(`SKILL.md not found in ${sourceDir}`);
  }

  const content = await fs.readFile(skillMdPath, 'utf8');
  return parseSkillMarkdown(content);
}

function parseSkillMarkdown(content: string): { name: string; description: string } {
  const normalized = normalizeLines(content);
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { name: '', description: '' };
  }

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    frontmatter[kv[1]] = stripYamlQuotes(kv[2]);
  }

  return {
    name: frontmatter.name || '',
    description: frontmatter.description || '',
  };
}

function validateSkillIdentity(skill: { name: string; description: string }, sourceLabel: string) {
  if (!skill.name) {
    throw new Error(`Skill is missing frontmatter name: ${sourceLabel}`);
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name)) {
    throw new Error(`Invalid skill name "${skill.name}" in ${sourceLabel}. Use lowercase kebab-case.`);
  }

  if (!skill.description) {
    throw new Error(`Skill is missing frontmatter description: ${sourceLabel}`);
  }
}

function extractRemoteFiles(detail: any): RemoteSkillFile[] {
  const files = detail?.files ?? detail?.data?.files ?? detail?.skill?.files;
  if (!Array.isArray(files)) return [];
  return files
    .filter((file) => typeof file?.path === 'string')
    .map((file) => ({
      path: file.path,
      contents: file.contents,
      content: file.content,
    }));
}

async function fetchText(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Request failed: HTTP ${resp.status} ${resp.statusText}`);
  }
  return resp.text();
}

function printResults(results: BuildResult[]) {
  for (const result of results) {
    logger.info(`  ${chalk.white(result.name)} -> ${chalk.gray(result.targetDir)}`);
  }
}

function stripYamlQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const quote = trimmed[0];
    if ((quote === '"' || quote === "'") && trimmed.at(-1) === quote) {
      const inner = trimmed.slice(1, -1);
      return quote === '"' ? inner.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : inner;
    }
  }
  return trimmed;
}

function normalizeLines(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function looksLikeGitRepo(value: string): boolean {
  return /\.git(?:#.+)?$/i.test(value);
}

function safeJoin(root: string, filePath: string): string {
  const normalized = filePath.replace(/^\/+/, '');
  const target = path.resolve(root, normalized);
  const relative = path.relative(root, target);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe remote file path: ${filePath}`);
  }

  return target;
}
