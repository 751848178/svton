#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  displayCommand,
  parseCaptureArgs,
  printUsage,
  sanitizeSegment,
  timestampForFile,
} from "./capture-tool-run.utils.mjs";

let options;
try {
  options = parseCaptureArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  printUsage();
  process.exit(2);
}
if (options.help) {
  printUsage();
  process.exit(0);
}

const safeProject = sanitizeSegment(options.project, "project");
const safeTask = sanitizeSegment(options.task, "tool-run");
const startedAt = new Date();
const logDir = path.join(options.logRoot, safeProject);
const fullLog = path.join(
  logDir,
  `${safeTask}-${timestampForFile(startedAt)}.log`,
);
const commandText = displayCommand(options.commandArgs, options.shellMode);

fs.mkdirSync(logDir, { recursive: true });

const log = fs.createWriteStream(fullLog, { flags: "w" });
let currentSection = null;
let stdoutBytes = 0;
let stderrBytes = 0;
let finalized = false;
let outputFitsThreshold = !options.alwaysSummary;
let stdoutChunks = [];
let stderrChunks = [];

function writeSection(label, chunk) {
  if (currentSection !== label) {
    log.write(`\n----- ${label.toUpperCase()} -----\n`);
    currentSection = label;
  }
  log.write(chunk);
}

function rememberSmallOutput(label, chunk) {
  if (!outputFitsThreshold) return;
  if (stdoutBytes + stderrBytes > options.summaryThresholdBytes) {
    outputFitsThreshold = false;
    stdoutChunks = [];
    stderrChunks = [];
    return;
  }
  (label === "stdout" ? stdoutChunks : stderrChunks).push(Buffer.from(chunk));
}

function replaySmallOutput(exitCode, error) {
  if (stdoutChunks.length) process.stdout.write(Buffer.concat(stdoutChunks));
  if (stderrChunks.length) process.stderr.write(Buffer.concat(stderrChunks));
  if (exitCode !== 0 || error) {
    const errorText = error ? ` error=${error}` : "";
    process.stderr.write(
      `\n[capture] exit_code=${exitCode}${errorText} full_log=${fullLog}\n`,
    );
  }
}

function finish(result) {
  if (finalized) {
    return;
  }
  finalized = true;

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : 1;
  const status = exitCode === 0 && !result.error ? "passed" : "failed";

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
    if (outputFitsThreshold) {
      replaySmallOutput(exitCode, result.error);
      process.exit(exitCode);
    }

    const summary = {
      task: options.task,
      status,
      command: commandText,
      exit_code: exitCode,
      signal: result.signal ?? null,
      full_log: fullLog,
      cwd: options.cwd,
      duration_ms: durationMs,
      stdout_bytes: stdoutBytes,
      stderr_bytes: stderrBytes,
      output_mode: "summary",
      summary_threshold_bytes: options.summaryThresholdBytes,
    };

    console.log(JSON.stringify(summary, null, 2));
    process.exit(exitCode);
  });
}

log.write(`----- CAPTURE HEADER -----\n`);
log.write(`task: ${options.task}\n`);
log.write(`project: ${options.project}\n`);
log.write(`cwd: ${options.cwd}\n`);
log.write(`started_at: ${startedAt.toISOString()}\n`);
log.write(`command: ${commandText}\n`);
log.write(`shell: ${options.shellMode ? "true" : "false"}\n`);
log.write(`summary_threshold_bytes: ${options.summaryThresholdBytes}\n`);

const child = spawn(
  options.shellMode ? commandText : options.commandArgs[0],
  options.shellMode ? [] : options.commandArgs.slice(1),
  {
    cwd: options.cwd,
    env: process.env,
    shell: options.shellMode,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

child.stdout.on("data", (chunk) => {
  stdoutBytes += chunk.length;
  rememberSmallOutput("stdout", chunk);
  writeSection("stdout", chunk);
});

child.stderr.on("data", (chunk) => {
  stderrBytes += chunk.length;
  rememberSmallOutput("stderr", chunk);
  writeSection("stderr", chunk);
});

child.on("error", (error) => {
  finish({ exitCode: 1, error: error.message });
});

child.on("close", (code, signal) => {
  finish({ exitCode: code ?? 1, signal });
});
