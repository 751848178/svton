import path from "node:path";

export const DEFAULT_SUMMARY_THRESHOLD_BYTES = 8 * 1024;

export function printUsage() {
  console.error(`Usage:
  capture-tool-run.mjs --project <name> --task <name> [--cwd <path>]
    [--log-dir <path>] [--summary-threshold-bytes <n>] [--always-summary]
    [--shell] -- <command> [args...]

Examples:
  capture-tool-run.mjs --project my-project --task typecheck -- npm run typecheck
  capture-tool-run.mjs --project my-project --task build --always-summary -- npm run build
`);
}

export function sanitizeSegment(value, fallback) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function quoteArg(arg) {
  if (/^[A-Za-z0-9_/:=.,@%+-]+$/.test(arg)) {
    return arg;
  }
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export function displayCommand(commandArgs, shellMode) {
  return shellMode
    ? commandArgs.join(" ")
    : commandArgs.map(quoteArg).join(" ");
}

function positiveInteger(value, option) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${option} must be a positive integer`);
  }
  return parsed;
}

export function parseCaptureArgs(args, environment = process.env) {
  const options = {
    project: path.basename(process.cwd()),
    task: "tool-run",
    cwd: process.cwd(),
    logRoot: environment.CODEX_TOOL_RUNS_DIR || "/tmp/codex-tool-runs",
    shellMode: false,
    alwaysSummary: false,
    summaryThresholdBytes: DEFAULT_SUMMARY_THRESHOLD_BYTES,
    commandArgs: [],
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      options.commandArgs = args.slice(index + 1);
      break;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }
    if (arg === "--project") options.project = args[++index];
    else if (arg === "--task") options.task = args[++index];
    else if (arg === "--cwd") options.cwd = path.resolve(args[++index]);
    else if (arg === "--log-dir") options.logRoot = path.resolve(args[++index]);
    else if (arg === "--shell") options.shellMode = true;
    else if (arg === "--always-summary") options.alwaysSummary = true;
    else if (arg === "--summary-threshold-bytes") {
      options.summaryThresholdBytes = positiveInteger(args[++index], arg);
    } else {
      throw new Error(`Unknown option before --: ${arg}`);
    }
  }

  if (options.commandArgs.length === 0) {
    throw new Error("Missing command after --");
  }
  return options;
}
