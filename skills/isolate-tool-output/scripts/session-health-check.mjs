#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  console.error(`Usage:
  session-health-check.mjs (--session <path> | --thread-id <id>)
    [--max-input <tokens>] [--max-compactions <count>]
`);
}

function positiveInteger(value, option) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${option} must be a positive integer`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    session: null,
    threadId: null,
    maxInput: 120_000,
    maxCompactions: 1,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }
    if (arg === "--session") options.session = path.resolve(argv[++index]);
    else if (arg === "--thread-id") options.threadId = argv[++index];
    else if (arg === "--max-input") {
      options.maxInput = positiveInteger(argv[++index], arg);
    } else if (arg === "--max-compactions") {
      options.maxCompactions = positiveInteger(argv[++index], arg);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!options.session && !options.threadId) {
    throw new Error("Provide --session or --thread-id");
  }
  return options;
}

function runAudit(options) {
  const auditScript = fileURLToPath(
    new URL("./codex-session-token-audit.mjs", import.meta.url),
  );
  const locator = options.session
    ? ["--session", options.session]
    : ["--thread-id", options.threadId];
  const result = spawnSync(
    process.execPath,
    [auditScript, ...locator, "--top", "1"],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "audit failed").trim());
  }
  return JSON.parse(result.stdout);
}

function healthResult(audit, options) {
  const aggregate = audit.token_aggregate ?? {};
  const lastInput = aggregate.last?.last_input ?? 0;
  const compactionCount = audit.compactions?.length ?? 0;
  const reasons = [];
  if (lastInput > options.maxInput) {
    reasons.push(`last_input ${lastInput} exceeds ${options.maxInput}`);
  }
  if (compactionCount >= options.maxCompactions) {
    reasons.push(
      `compactions ${compactionCount} reached ${options.maxCompactions}`,
    );
  }
  const action = reasons.length > 0 ? "wrap_and_split" : "continue";
  return {
    task: "session-health-check",
    status: "checked",
    action,
    session: audit.session,
    last_input_tokens: lastInput,
    max_last_input_tokens: aggregate.max_last_input ?? 0,
    compaction_count: compactionCount,
    thresholds: {
      max_input_tokens: options.maxInput,
      max_compactions: options.maxCompactions,
    },
    reasons,
  };
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    process.exit(0);
  }
  console.log(
    JSON.stringify(healthResult(runAudit(options), options), null, 2),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  usage();
  process.exit(1);
}
