#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function printUsage() {
  console.error(`Usage:
  capture-tool-run.mjs --project <name> --task <name> [--cwd <path>] [--log-dir <path>] [--shell] -- <command> [args...]

Examples:
  capture-tool-run.mjs --project my-project --task typecheck -- npm run typecheck
  capture-tool-run.mjs --project my-project --task rg-generated --shell -- "rg -n 'TODO' .next dist build"
`);
}

function sanitizeSegment(value, fallback) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function quoteArg(arg) {
  if (/^[A-Za-z0-9_/:=.,@%+-]+$/.test(arg)) {
    return arg;
  }
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function displayCommand(commandArgs, shellMode) {
  return shellMode ? commandArgs.join(' ') : commandArgs.map(quoteArg).join(' ');
}

const args = process.argv.slice(2);
let project = path.basename(process.cwd());
let task = 'tool-run';
let cwd = process.cwd();
let logRoot = process.env.CODEX_TOOL_RUNS_DIR || '/tmp/codex-tool-runs';
let shellMode = false;
let commandArgs = [];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];

  if (arg === '--') {
    commandArgs = args.slice(index + 1);
    break;
  }

  if (arg === '--help' || arg === '-h') {
    printUsage();
    process.exit(0);
  }

  if (arg === '--project') {
    project = args[++index];
    continue;
  }

  if (arg === '--task') {
    task = args[++index];
    continue;
  }

  if (arg === '--cwd') {
    cwd = path.resolve(args[++index]);
    continue;
  }

  if (arg === '--log-dir') {
    logRoot = path.resolve(args[++index]);
    continue;
  }

  if (arg === '--shell') {
    shellMode = true;
    continue;
  }

  console.error(`Unknown option before --: ${arg}`);
  printUsage();
  process.exit(2);
}

if (commandArgs.length === 0) {
  console.error('Missing command after --');
  printUsage();
  process.exit(2);
}

const safeProject = sanitizeSegment(project, 'project');
const safeTask = sanitizeSegment(task, 'tool-run');
const startedAt = new Date();
const logDir = path.join(logRoot, safeProject);
const fullLog = path.join(logDir, `${safeTask}-${timestampForFile(startedAt)}.log`);
const commandText = displayCommand(commandArgs, shellMode);

fs.mkdirSync(logDir, { recursive: true });

const log = fs.createWriteStream(fullLog, { flags: 'w' });
let currentSection = null;
let stdoutBytes = 0;
let stderrBytes = 0;
let finalized = false;

function writeSection(label, chunk) {
  if (currentSection !== label) {
    log.write(`\n----- ${label.toUpperCase()} -----\n`);
    currentSection = label;
  }
  log.write(chunk);
}

function finish(result) {
  if (finalized) {
    return;
  }
  finalized = true;

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : 1;
  const status = exitCode === 0 && !result.error ? 'passed' : 'failed';

  log.write(`\n\n----- CAPTURE FOOTER -----\n`);
  log.write(`finished_at: ${finishedAt.toISOString()}\n`);
  log.write(`duration_ms: ${durationMs}\n`);
  log.write(`exit_code: ${exitCode}\n`);
  if (result.signal) {
    log.write(`signal: ${result.signal}\n`);
  }
  if (result.error) {
    log.write(`error: ${result.error}\n`);
  }

  log.end(() => {
    const summary = {
      task,
      status,
      command: commandText,
      exit_code: exitCode,
      signal: result.signal ?? null,
      full_log: fullLog,
      cwd,
      duration_ms: durationMs,
      stdout_bytes: stdoutBytes,
      stderr_bytes: stderrBytes,
    };

    console.log(JSON.stringify(summary, null, 2));
    process.exit(exitCode);
  });
}

log.write(`----- CAPTURE HEADER -----\n`);
log.write(`task: ${task}\n`);
log.write(`project: ${project}\n`);
log.write(`cwd: ${cwd}\n`);
log.write(`started_at: ${startedAt.toISOString()}\n`);
log.write(`command: ${commandText}\n`);
log.write(`shell: ${shellMode ? 'true' : 'false'}\n`);

const child = spawn(shellMode ? commandText : commandArgs[0], shellMode ? [] : commandArgs.slice(1), {
  cwd,
  env: process.env,
  shell: shellMode,
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (chunk) => {
  stdoutBytes += chunk.length;
  writeSection('stdout', chunk);
});

child.stderr.on('data', (chunk) => {
  stderrBytes += chunk.length;
  writeSection('stderr', chunk);
});

child.on('error', (error) => {
  finish({ exitCode: 1, error: error.message });
});

child.on('close', (code, signal) => {
  finish({ exitCode: code ?? 1, signal });
});
