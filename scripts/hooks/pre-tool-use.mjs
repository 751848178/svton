#!/usr/bin/env node
// PreToolUse hook for Codex + Claude Code.
// Intercepts risky direct and statically nested shell commands and either
// blocks high-risk calls or warns on lower-risk calls.
// Shared by .claude/settings.json and .codex/hooks.json.
//
// Supported inputs include tool_input.command, tool_input.cmd, and static
// tools.exec_command({ cmd: "..." }) calls inside functions.exec source.
//
// Fail-open: any internal error → exit 0 (never let the hook block a tool call
// because of its own bug).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { extractShellCommands } from "./tool-command-extractor.mjs";

// Violations that hard-block execution (token bloat too costly to allow).
const DENY_VIOLATIONS = new Set([
  "raw-broad-search", // broad multi-path rg without --max-count/-l/--count
  "raw-git-diff", // full diff should be logged and summarized
  "session-jsonl-search", // rg over .jsonl dumps whole prompt/tool lines
  "large-log-reread", // re-reading isolated logs back into context
]);

// Window-size thresholds for sed/tail: above DENY_LINES → block, between
// WARN_LINES and DENY_LINES → warn. Below WARN_LINES the classifier reports
// nothing anyway (its own 120-line default).
const DENY_LINES = 250;

function findRepoRoot(start) {
  let dir = start && existsSync(start) ? path.resolve(start) : process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: script lives at <repo>/scripts/hooks/, so two levels up.
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function hasEscapeHatch(command) {
  if (process.env.SVTON_TOKEN_GUARD === "off") return true;
  return /#\s*noqa\s+token-guard\b/i.test(command);
}

// Classify a single violation into deny/warn. Size-based ones need a number.
function classifyViolation(violation, sedLines, tailLines) {
  if (DENY_VIOLATIONS.has(violation)) return "deny";
  if (violation === "large-sed-window" || violation === "large-tail-window") {
    const lines = violation === "large-sed-window" ? sedLines : tailLines;
    return lines && lines > DENY_LINES ? "deny" : "warn";
  }
  return "warn";
}

function formatReason(result) {
  const top = result.recommended_tools[0];
  const suggestion = top ? `\nUse instead: ${top.command}` : "";
  return `token-guard blocked (${result.violations.join(", ")}).${suggestion}`;
}

async function main() {
  const raw = readStdin();
  if (!raw.trim()) process.exit(0);

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    // Malformed payload — not ours to handle. Allow the call.
    process.exit(0);
  }

  const commands = extractShellCommands(input);
  if (commands.length === 0) process.exit(0);

  const repoRoot = findRepoRoot(input?.cwd);
  const tokenGuardPath = path.join(
    repoRoot,
    "skills",
    "isolate-tool-output",
    "scripts",
    "token-guard.mjs",
  );
  if (!existsSync(tokenGuardPath)) process.exit(0);

  let analyze;
  try {
    ({ analyze } = await import(`file://${tokenGuardPath}`));
  } catch (error) {
    // Cannot load classifier — fail-open, but surface for debugging.
    console.error(`token-guard: load failed: ${error?.message ?? error}`);
    process.exit(0);
  }

  for (const command of commands) {
    if (hasEscapeHatch(command)) continue;
    let result;
    try {
      result = analyze({
        cwd: input?.cwd || repoRoot,
        command,
        project: "svton",
      });
    } catch (error) {
      console.error(`token-guard: analyze failed: ${error?.message ?? error}`);
      continue;
    }
    if (result.status !== "route_to_compact_tool") continue;

    const decision = result.violations.some(
      (violation) =>
        classifyViolation(
          violation,
          parseSedLines(command),
          parseTailLines(command),
        ) === "deny",
    )
      ? "deny"
      : "warn";

    if (decision === "deny") {
      console.error(formatReason(result));
      process.exit(2);
    }
    const top = result.recommended_tools[0];
    if (top) {
      console.error(`token-guard hint: ${top.reason} → ${top.command}`);
    }
  }
}

function parseSedLines(command) {
  const m = command.match(/sed\s+-n\s+['"]?(\d+),(\d+)p['"]?/);
  return m ? Number(m[2]) - Number(m[1]) + 1 : null;
}

function parseTailLines(command) {
  const m = command.match(/tail\s+-n\s+(\d+)/);
  return m ? Number(m[1]) : null;
}

main().catch((error) => {
  // Last-resort fail-open.
  console.error(`token-guard hook error: ${error?.message ?? error}`);
  process.exit(0);
});
