#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_EXCLUDES = [
  '!node_modules/**',
  '!.git/**',
  '!.next/**',
  '!dist/**',
  '!build/**',
  '!target/**',
  '!.turbo/**',
  '!.codegraph/**',
  '!coverage/**',
  '!**/src-tauri/target/**',
  '!**/public/skills/**',
];

function usage() {
  console.error(`Usage:
  smart-rg.mjs [--project <name>] [--task <name>] [--cwd <path>] [--log-dir <path>]
    [--glob <glob>] [--max-files <n>] [--samples-per-file <n>] [--max-total-samples <n>] [--fixed] -- <pattern> [paths...]

Example:
  smart-rg.mjs --project my-project --task policy-search --cwd /path/to/repo -- "AccessPolicyService" src docs
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

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function quoteArg(arg) {
  return /^[A-Za-z0-9_/:=.,@%+-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`;
}

function assessQueryRisk(pattern, paths) {
  // Detect broad-search shapes that historically saturate the output cap.
  // Returning a non-empty risk means the caller should narrow scope next time.
  const risks = [];
  const patternStr = String(pattern ?? '');
  if (patternStr.includes('|')) {
    risks.push('multi-keyword OR pattern: split into one term per rg call');
  }
  if ((patternStr.match(/\|/g) || []).length >= 3) {
    risks.push('4+ alternations: almost certainly saturates the output cap');
  }
  const rootCount = paths.filter((p) => p === '.' || p === '/' || !p.includes('/')).length;
  if (paths.length >= 3 || rootCount >= 2) {
    risks.push(`${paths.length || 1} search roots: narrow to one module directory first`);
  }
  return risks;
}

function parseArgs(argv) {
  const options = {
    project: path.basename(process.cwd()),
    task: 'smart-rg',
    cwd: process.cwd(),
    logRoot: process.env.CODEX_TOOL_RUNS_DIR || '/tmp/codex-tool-runs',
    globs: [],
    maxFiles: 30,
    samplesPerFile: 2,
    maxTotalSamples: 40,
    fixed: false,
  };

  let rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      rest = argv.slice(index + 1);
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
    if (arg === '--glob' || arg === '-g') {
      options.globs.push(argv[++index]);
      continue;
    }
    if (arg === '--max-files') {
      options.maxFiles = parsePositiveInt(argv[++index], options.maxFiles);
      continue;
    }
    if (arg === '--samples-per-file') {
      options.samplesPerFile = parsePositiveInt(argv[++index], options.samplesPerFile);
      continue;
    }
    if (arg === '--max-total-samples') {
      options.maxTotalSamples = parsePositiveInt(argv[++index], options.maxTotalSamples);
      continue;
    }
    if (arg === '--fixed' || arg === '-F') {
      options.fixed = true;
      continue;
    }
    console.error(`Unknown option before --: ${arg}`);
    usage();
    process.exit(2);
  }

  if (rest.length === 0) {
    console.error('Missing pattern after --');
    usage();
    process.exit(2);
  }

  return {
    ...options,
    pattern: rest[0],
    paths: rest.slice(1),
  };
}

function addMatch(summary, event, options) {
  const filePath = event.data?.path?.text;
  const lineNumber = event.data?.line_number;
  const lineText = event.data?.lines?.text;
  if (!filePath || !Number.isInteger(lineNumber)) {
    return;
  }

  let file = summary.filesByPath.get(filePath);
  if (!file) {
    file = { path: filePath, matches: 0, samples: [] };
    summary.filesByPath.set(filePath, file);
  }

  file.matches += 1;
  summary.total_matches += 1;

  if (
    file.samples.length < options.samplesPerFile &&
    summary.total_samples < options.maxTotalSamples
  ) {
    file.samples.push({
      line: lineNumber,
      text: String(lineText ?? '').trimEnd().slice(0, 240),
    });
    summary.total_samples += 1;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const safeProject = sanitize(options.project, 'project');
  const safeTask = sanitize(options.task, 'smart-rg');
  const startedAt = new Date();
  const logDir = path.join(options.logRoot, safeProject);
  const fullLog = path.join(logDir, `${safeTask}-${timestampForFile(startedAt)}.log`);

  fs.mkdirSync(logDir, { recursive: true });
  const log = fs.createWriteStream(fullLog, { flags: 'w' });

  const rgArgs = ['--json', '--color', 'never'];
  if (options.fixed) {
    rgArgs.push('-F');
  }
  for (const glob of [...DEFAULT_EXCLUDES, ...options.globs]) {
    rgArgs.push('-g', glob);
  }
  rgArgs.push(options.pattern, ...(options.paths.length > 0 ? options.paths : ['.']));

  const command = ['rg', ...rgArgs].map(quoteArg).join(' ');
  log.write(`----- SMART RG HEADER -----${os.EOL}`);
  log.write(`task: ${options.task}${os.EOL}`);
  log.write(`cwd: ${options.cwd}${os.EOL}`);
  log.write(`started_at: ${startedAt.toISOString()}${os.EOL}`);
  log.write(`command: ${command}${os.EOL}${os.EOL}`);
  log.write(`----- STDOUT RG JSON -----${os.EOL}`);

  const summary = {
    task: options.task,
    status: 'failed',
    command,
    cwd: options.cwd,
    pattern: options.pattern,
    searched_paths: options.paths.length > 0 ? options.paths : ['.'],
    full_log: fullLog,
    total_matches: 0,
    matched_files: 0,
    files_truncated: false,
    files: [],
    query_risk: [],
    samples_truncated: false,
    stderr_sample: '',
    duration_ms: 0,
    exit_code: null,
    filesByPath: new Map(),
    total_samples: 0,
  };

  await new Promise((resolve) => {
    const child = spawn('rg', rgArgs, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutBuffer = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      log.write(text);
      stdoutBuffer += text;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        try {
          const event = JSON.parse(line);
          if (event.type === 'match') {
            addMatch(summary, event, options);
          }
        } catch {
          // Keep raw output in the log; parsing only affects the compact summary.
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      stderr += text;
    });

    child.on('error', (error) => {
      stderr += error.message;
    });

    child.on('close', (code, signal) => {
      if (stdoutBuffer.trim()) {
        try {
          const event = JSON.parse(stdoutBuffer);
          if (event.type === 'match') {
            addMatch(summary, event, options);
          }
        } catch {
          // Raw line is already in the log.
        }
      }

      const finishedAt = new Date();
      summary.duration_ms = finishedAt.getTime() - startedAt.getTime();
      summary.exit_code = code ?? 1;
      summary.status = summary.exit_code === 0
        ? 'matched'
        : summary.exit_code === 1
          ? 'no_matches'
          : 'failed';
      summary.stderr_sample = stderr.trim().slice(0, 1000);
      summary.matched_files = summary.filesByPath.size;
      summary.files = [...summary.filesByPath.values()]
        .sort((a, b) => b.matches - a.matches || a.path.localeCompare(b.path))
        .slice(0, options.maxFiles);
      summary.files_truncated = summary.matched_files > summary.files.length;
      summary.samples_truncated = summary.total_matches > summary.total_samples;
      summary.query_risk = assessQueryRisk(options.pattern, options.paths);

      log.write(`${os.EOL}----- STDERR -----${os.EOL}${stderr}`);
      log.write(`${os.EOL}----- SMART RG FOOTER -----${os.EOL}`);
      log.write(`finished_at: ${finishedAt.toISOString()}${os.EOL}`);
      log.write(`duration_ms: ${summary.duration_ms}${os.EOL}`);
      log.write(`exit_code: ${summary.exit_code}${os.EOL}`);
      if (signal) {
        log.write(`signal: ${signal}${os.EOL}`);
      }
      log.end(resolve);
    });
  });

  delete summary.filesByPath;
  delete summary.total_samples;
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.status === 'failed' ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
