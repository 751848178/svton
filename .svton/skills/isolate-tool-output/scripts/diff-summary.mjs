#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function usage() {
  console.error(`Usage:
  diff-summary.mjs [--project <name>] [--task <name>] [--cwd <path>] [--log-dir <path>] [--staged] -- [paths...]

Example:
  diff-summary.mjs --project svton --task touched-diff --cwd /repo -- apps/devpilot-api/src docs-internal
`);
}

function sanitize(value, fallback) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function quoteArg(arg) {
  return /^[A-Za-z0-9_/:=.,@%+-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`;
}

function parseArgs(argv) {
  const options = {
    project: path.basename(process.cwd()),
    task: 'diff-summary',
    cwd: process.cwd(),
    logRoot: process.env.CODEX_TOOL_RUNS_DIR || '/tmp/codex-tool-runs',
    staged: false,
    paths: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      options.paths = argv.slice(index + 1);
      break;
    }
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--project') {
      options.project = argv[++index];
      continue;
    }
    if (arg === '--task') {
      options.task = argv[++index];
      continue;
    }
    if (arg === '--cwd') {
      options.cwd = path.resolve(argv[++index]);
      continue;
    }
    if (arg === '--log-dir') {
      options.logRoot = path.resolve(argv[++index]);
      continue;
    }
    if (arg === '--staged' || arg === '--cached') {
      options.staged = true;
      continue;
    }
    console.error(`Unknown option before --: ${arg}`);
    usage();
    process.exit(2);
  }

  return options;
}

function gitOutput(cwd, args, maxLines = 120) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const combined = [stdout.trimEnd(), stderr.trimEnd()].filter(Boolean).join('\n');
  const lines = combined ? combined.split(/\r?\n/) : [];
  return {
    command: ['git', ...args].map(quoteArg).join(' '),
    exit_code: Number.isInteger(result.status) ? result.status : 1,
    line_count: lines.length,
    truncated: lines.length > maxLines,
    output: lines.slice(0, maxLines),
  };
}

function gitRepoStatus(cwd) {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  return {
    ok: result.status === 0 && result.stdout.trim() === 'true',
    exit_code: Number.isInteger(result.status) ? result.status : 1,
    message: (result.stderr || result.stdout || '').trim().split(/\r?\n/).slice(0, 5),
  };
}

function writeFullDiff(options, fullLog, diffArgs) {
  return new Promise((resolve) => {
    const log = fs.createWriteStream(fullLog, { flags: 'w' });
    const command = ['git', ...diffArgs].map(quoteArg).join(' ');
    const startedAt = new Date();
    log.write(`----- DIFF SUMMARY HEADER -----${os.EOL}`);
    log.write(`task: ${options.task}${os.EOL}`);
    log.write(`cwd: ${options.cwd}${os.EOL}`);
    log.write(`started_at: ${startedAt.toISOString()}${os.EOL}`);
    log.write(`command: ${command}${os.EOL}${os.EOL}`);
    log.write(`----- FULL DIFF -----${os.EOL}`);

    let stdoutBytes = 0;
    let stderrBytes = 0;
    const child = spawn('git', diffArgs, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      log.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderrBytes += chunk.length;
      log.write(`${os.EOL}----- STDERR -----${os.EOL}`);
      log.write(chunk);
    });
    child.on('error', (error) => {
      log.write(`${os.EOL}error: ${error.message}${os.EOL}`);
    });
    child.on('close', (code, signal) => {
      const finishedAt = new Date();
      log.write(`${os.EOL}----- DIFF SUMMARY FOOTER -----${os.EOL}`);
      log.write(`finished_at: ${finishedAt.toISOString()}${os.EOL}`);
      log.write(`exit_code: ${code ?? 1}${os.EOL}`);
      if (signal) {
        log.write(`signal: ${signal}${os.EOL}`);
      }
      log.end(() => resolve({
        command,
        exit_code: code ?? 1,
        stdout_bytes: stdoutBytes,
        stderr_bytes: stderrBytes,
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
      }));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const safeProject = sanitize(options.project, 'project');
  const safeTask = sanitize(options.task, 'diff-summary');
  const logDir = path.join(options.logRoot, safeProject);
  const fullLog = path.join(logDir, `${safeTask}-${timestampForFile()}.diff`);
  fs.mkdirSync(logDir, { recursive: true });

  const repoStatus = gitRepoStatus(options.cwd);
  if (!repoStatus.ok) {
    console.log(JSON.stringify({
      task: options.task,
      status: 'not_git_repo',
      cwd: options.cwd,
      paths: options.paths,
      exit_code: repoStatus.exit_code,
      summary: repoStatus.message,
    }, null, 2));
    process.exit(1);
  }

  const base = ['diff'];
  if (options.staged) {
    base.push('--staged');
  }
  const pathArgs = options.paths.length > 0 ? ['--', ...options.paths] : [];
  const fullDiff = await writeFullDiff(options, fullLog, [...base, ...pathArgs]);

  const stat = gitOutput(options.cwd, [...base, '--stat', ...pathArgs], 160);
  const nameStatus = gitOutput(options.cwd, [...base, '--name-status', ...pathArgs], 200);
  const numstat = gitOutput(options.cwd, [...base, '--numstat', ...pathArgs], 200);
  const check = gitOutput(options.cwd, [...base, '--check', ...pathArgs], 120);

  const changedFiles = nameStatus.output
    .map((line) => line.split(/\t+/).filter(Boolean).at(-1))
    .filter(Boolean);

  const result = {
    task: options.task,
    status: check.exit_code === 0 ? 'summarized' : 'diff_check_failed',
    cwd: options.cwd,
    staged: options.staged,
    paths: options.paths,
    full_log: fullLog,
    full_diff: fullDiff,
    changed_file_count: changedFiles.length,
    changed_files: changedFiles.slice(0, 80),
    changed_files_truncated: changedFiles.length > 80,
    stat,
    name_status: nameStatus,
    numstat,
    check,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(check.exit_code === 0 ? 0 : check.exit_code);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
