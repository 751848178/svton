import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Dirent } from 'fs';
import { lstat, readFile, readdir } from 'fs/promises';
import { join, relative, resolve, sep } from 'path';
import { REPOSITORY_ANALYSIS_DEFAULTS } from './repository-analysis.constants';
import { analysisError } from './repository-analysis-execution.error';
import { RepositoryInventory } from './repository-parser.types';

const SKIPPED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  'target',
]);
const READABLE_EXTENSIONS = /\.(?:[cm]?[jt]sx?|json|ya?ml|prisma|toml)$/i;
const SAFE_ENV_FILE = /^\.env\.(?:example|sample|template|defaults)$/i;

@Injectable()
export class RepositoryInventoryService {
  private readonly maxFiles: number;
  private readonly maxBytes: number;
  private readonly maxReadBytes: number;
  private readonly maxFileBytes: number;

  constructor(config: ConfigService) {
    this.maxFiles = numberSetting(config, 'REPOSITORY_ANALYSIS_MAX_FILES', REPOSITORY_ANALYSIS_DEFAULTS.maxFiles);
    this.maxBytes = numberSetting(config, 'REPOSITORY_ANALYSIS_MAX_BYTES', REPOSITORY_ANALYSIS_DEFAULTS.maxRepositoryBytes);
    this.maxReadBytes = numberSetting(config, 'REPOSITORY_ANALYSIS_MAX_READ_BYTES', REPOSITORY_ANALYSIS_DEFAULTS.maxReadBytes);
    this.maxFileBytes = numberSetting(config, 'REPOSITORY_ANALYSIS_MAX_FILE_BYTES', REPOSITORY_ANALYSIS_DEFAULTS.maxFileBytes);
  }

  async inventory(root: string, deadline: number, signal?: AbortSignal): Promise<RepositoryInventory> {
    const rootPath = resolve(root);
    const state = {
      files: [] as string[],
      totalFiles: 0,
      totalBytes: 0,
      readBytes: 0,
      manifests: {} as Record<string, string>,
    };
    await this.walk(rootPath, rootPath, state, deadline, signal);
    return {
      files: state.files.sort(),
      totalFiles: state.totalFiles,
      totalBytes: state.totalBytes,
      manifests: state.manifests,
    };
  }

  private async walk(
    root: string,
    directory: string,
    state: {
      files: string[];
      totalFiles: number;
      totalBytes: number;
      readBytes: number;
      manifests: Record<string, string>;
    },
    deadline: number,
    signal?: AbortSignal,
  ): Promise<void> {
    this.assertActive(deadline, signal);
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      this.assertActive(deadline, signal);
      if (entry.isSymbolicLink()) continue;
      const absolute = join(directory, entry.name);
      if (!inside(root, absolute)) continue;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          await this.walk(root, absolute, state, deadline, signal);
        }
        continue;
      }
      if (!entry.isFile()) continue;
      await this.recordFile(root, absolute, entry, state);
    }
  }

  private async recordFile(
    root: string,
    absolute: string,
    _entry: Dirent,
    state: {
      files: string[];
      totalFiles: number;
      totalBytes: number;
      readBytes: number;
      manifests: Record<string, string>;
    },
  ): Promise<void> {
    const stat = await lstat(absolute);
    state.totalFiles += 1;
    state.totalBytes += stat.size;
    if (state.totalFiles > this.maxFiles || state.totalBytes > this.maxBytes) {
      throw analysisError(
        'REPOSITORY_LIMIT_EXCEEDED',
        '仓库超过解析安全限制',
        '请缩小仓库范围，或由管理员审查后提高文件数/体积限制。',
      );
    }
    const path = relative(root, absolute).split(sep).join('/');
    state.files.push(path);
    if (!shouldRead(path) || stat.size > this.maxFileBytes) return;
    if (state.readBytes + stat.size > this.maxReadBytes) return;
    state.manifests[path] = await readFile(absolute, 'utf8');
    state.readBytes += stat.size;
  }

  private assertActive(deadline: number, signal?: AbortSignal): void {
    if (signal?.aborted) throw analysisError(
      'REPOSITORY_ANALYSIS_CANCELLED',
      '解析已取消',
      '可从运行历史重新发起解析。',
    );
    if (Date.now() > deadline) throw analysisError(
      'REPOSITORY_ANALYSIS_TIMEOUT',
      '代码解析超时',
      '请检查仓库规模或提高受控解析超时时间后重试。',
    );
  }
}

function shouldRead(path: string): boolean {
  const name = path.split('/').pop() || '';
  if (name.startsWith('.env')) return SAFE_ENV_FILE.test(name);
  return READABLE_EXTENSIONS.test(name)
    || name === 'Dockerfile'
    || name === '.nvmrc'
    || name === '.node-version';
}

function inside(root: string, child: string): boolean {
  const value = relative(root, resolve(child));
  return value === '' || (!value.startsWith('..') && !value.startsWith(sep));
}

function numberSetting(config: ConfigService, key: string, fallback: number): number {
  const value = Number(config.get(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
