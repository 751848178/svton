#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const VALID_WORKER_STATUSES = new Set([
  "queued",
  "active",
  "completed",
  "blocked",
  "handoff_required",
  "failed",
]);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      args._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    i += 1;
    if (args[key] === undefined) {
      args[key] = next;
    } else if (Array.isArray(args[key])) {
      args[key].push(next);
    } else {
      args[key] = [args[key], next];
    }
  }
  return args;
}

function listArg(value) {
  if (value === undefined || value === true) return [];
  return Array.isArray(value) ? value : [value];
}

function requireArg(args, name) {
  const value = args[name];
  if (value === undefined || value === true || value === "") {
    throw new Error(`Missing required --${name}`);
  }
  return String(value);
}

function slugify(value) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "long-goal";
}

function timestamp() {
  return new Date().toISOString();
}

function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, content);
  fs.renameSync(tmpPath, filePath);
}

function loadBoard(boardPath) {
  return JSON.parse(fs.readFileSync(boardPath, "utf8"));
}

function saveBoard(boardPath, board) {
  board.updatedAt = timestamp();
  atomicWrite(boardPath, `${JSON.stringify(board, null, 2)}\n`);
  atomicWrite(board.markdownPath, renderMarkdown(board));
}

function renderMarkdown(board) {
  const lines = [
    `# ${board.project} Long Goal Board`,
    "",
    `- status: ${board.status}`,
    `- objective: ${board.objective}`,
    `- cwd: ${board.cwd}`,
    `- created: ${board.createdAt}`,
    `- updated: ${board.updatedAt}`,
    `- worker policy: ${board.workerPolicy}`,
    "",
    "## Workers",
    "",
    "| id | status | mode | title | thread | result |",
    "| --- | --- | --- | --- | --- | --- |",
  ];

  for (const worker of board.workers) {
    lines.push(
      `| ${worker.id} | ${worker.status} | ${worker.mode} | ${worker.title} | ${worker.threadId || ""} | ${worker.resultPath || ""} |`,
    );
  }

  if (board.workers.length === 0) {
    lines.push("| | | | | | |");
  }

  lines.push("", "## Notes", "");
  for (const note of board.notes || []) {
    lines.push(`- ${note}`);
  }
  lines.push("");
  return lines.join("\n");
}

function makeWorkerPrompt(board, worker, promptPath) {
  const scopes = worker.scope.length ? worker.scope.map((item) => `- ${item}`).join("\n") : "- Use the worker objective only.";
  const paths = worker.paths.length ? worker.paths.map((item) => `- ${item}`).join("\n") : "- No extra path window was supplied.";
  const verification = worker.verification.length ? worker.verification.map((item) => `- ${item}`).join("\n") : "- Run the smallest verification that proves this worker slice.";
  const dependsOn = worker.dependsOn.length ? worker.dependsOn.map((item) => `- ${item}`).join("\n") : "- None.";

  return `/goal Complete exactly this orchestrated worker slice, report the result, and stop.

You are a worker thread under a long-goal orchestrator. Do not become the orchestrator, do not create successor worker threads, and do not continue into another slice after this worker is complete.

Board: ${board.boardPath}
Worker id: ${worker.id}
Project: ${board.project}
CWD: ${board.cwd}
Mode: ${worker.mode}
Title: ${worker.title}
Objective: ${worker.objective}
Prompt file: ${promptPath}

Dependencies:
${dependsOn}

Scope:
${scopes}

Allowed path window:
${paths}

Verification:
${verification}

Rules:
- Start with a scoped worktree/status check and only read the board plus the listed handoff/docs/files needed for this worker.
- Preserve unrelated dirty work. In the same checkout, only one write worker should be active at a time unless the orchestrator assigned independent paths or worktrees.
- If session health says wrap_and_split, generate a compact handoff, write this worker result with status handoff_required, and stop. Do not create a new worker thread yourself.
- Never call update_goal(status="blocked") for compaction, token budget, wrap_and_split, or ordinary slice handoff.
- At completion, update the board with:
  node ${path.resolve(SCRIPT_DIR, "codex-long-goal-board.mjs")} complete --board ${board.boardPath} --id ${worker.id} --status completed --summary "<one-line verified result>"
- If blocked, use status blocked and include the concrete blocker. If verification failed, use status failed.
- Final response should include worker id, status, board path, result path, changed files, and verification log paths.
`;
}

function init(args) {
  const project = requireArg(args, "project");
  const cwd = path.resolve(requireArg(args, "cwd"));
  const objective = requireArg(args, "objective");
  const root = args.root
    ? path.resolve(String(args.root))
    : `/tmp/codex-tool-runs/${project}/long-goals`;
  const slug = slugify(args.slug || objective);
  const dir = path.join(root, slug);
  const boardPath = path.join(dir, "board.json");
  const markdownPath = path.join(dir, "board.md");
  const now = timestamp();
  const board = {
    version: 1,
    project,
    cwd,
    objective,
    status: "active",
    createdAt: now,
    updatedAt: now,
    boardPath,
    markdownPath,
    workerPolicy: "single-checkout-one-active-write-worker; parallel read-only workers or separate worktrees only when explicitly assigned",
    workers: [],
    notes: [
      "The orchestrator owns scheduling and status. Workers complete one slice and stop.",
      "Workers write compact result files; do not replay old sessions as context.",
    ],
  };

  saveBoard(boardPath, board);
  console.log(JSON.stringify({ boardPath, markdownPath, dir }, null, 2));
}

function addWorker(args) {
  const boardPath = path.resolve(requireArg(args, "board"));
  const board = loadBoard(boardPath);
  const title = requireArg(args, "title");
  const id = slugify(args.id || title);
  if (board.workers.some((worker) => worker.id === id)) {
    throw new Error(`Worker already exists: ${id}`);
  }

  const mode = String(args.mode || "write");
  if (!["read", "write"].includes(mode)) {
    throw new Error("--mode must be read or write");
  }

  const workerDir = path.join(path.dirname(boardPath), "workers");
  const promptPath = path.join(workerDir, `${id}-prompt.md`);
  const worker = {
    id,
    title,
    objective: String(args.objective || title),
    mode,
    status: "queued",
    scope: listArg(args.scope),
    paths: listArg(args.path),
    dependsOn: listArg(args["depends-on"]),
    verification: listArg(args.verification),
    promptPath,
    resultPath: "",
    threadId: "",
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };

  board.workers.push(worker);
  atomicWrite(promptPath, makeWorkerPrompt(board, worker, promptPath));
  saveBoard(boardPath, board);
  console.log(JSON.stringify({ boardPath, workerId: id, promptPath }, null, 2));
}

function completeWorker(args) {
  const boardPath = path.resolve(requireArg(args, "board"));
  const id = requireArg(args, "id");
  const status = String(args.status || "completed");
  if (!VALID_WORKER_STATUSES.has(status)) {
    throw new Error(`Invalid --status: ${status}`);
  }

  const board = loadBoard(boardPath);
  const worker = board.workers.find((item) => item.id === id);
  if (!worker) {
    throw new Error(`Unknown worker id: ${id}`);
  }

  const resultPath = path.join(path.dirname(boardPath), "workers", `${id}-result.json`);
  const result = {
    workerId: id,
    status,
    summary: String(args.summary || ""),
    threadId: String(args["thread-id"] || worker.threadId || ""),
    handoff: String(args.handoff || ""),
    changed: listArg(args.changed),
    logs: listArg(args.log),
    updatedAt: timestamp(),
  };

  worker.status = status;
  worker.updatedAt = result.updatedAt;
  worker.threadId = result.threadId;
  worker.resultPath = resultPath;
  worker.handoff = result.handoff;
  atomicWrite(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  saveBoard(boardPath, board);
  console.log(JSON.stringify({ boardPath, workerId: id, resultPath, status }, null, 2));
}

function render(args) {
  const boardPath = path.resolve(requireArg(args, "board"));
  const board = loadBoard(boardPath);
  const markdown = renderMarkdown(board);
  atomicWrite(board.markdownPath, markdown);
  console.log(markdown);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (command === "init") return init(args);
  if (command === "add-worker") return addWorker(args);
  if (command === "complete") return completeWorker(args);
  if (command === "render") return render(args);
  throw new Error("Usage: codex-long-goal-board.mjs <init|add-worker|complete|render> [args]");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
