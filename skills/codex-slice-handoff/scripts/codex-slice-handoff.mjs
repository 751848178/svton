#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_MAX_INPUT = 120000;
const DEFAULT_COMPACTIONS = 1;
const DEFAULT_TOOL_OUTPUT_TOKENS = 40000;
const DEFAULT_MAX_FILES = 24;
const DEFAULT_RECENT_MESSAGES = 6;

function usage() {
  console.error(`Usage:
  codex-slice-handoff.mjs --session <rollout.jsonl> [--cwd <repo>] [options]
  codex-slice-handoff.mjs --thread-id <codex-thread-id> [--cwd <repo>] [options]

Options:
  --project <name>                 Project name for /tmp/codex-tool-runs/<project>
  --task <name>                    Log/output task name (default: slice-handoff)
  --objective <text>               One-sentence objective to include in the handoff
  --stage <text>                   Current Fxx/module/stage label
  --done <text>                    Completed item; repeatable
  --next <text>                    Next item; repeatable
  --risk <text>                    Known risk/gap; repeatable
  --max-input-threshold <tokens>   Slice when last_input reaches this value (default: ${DEFAULT_MAX_INPUT})
  --compaction-threshold <count>   Slice when compactions reach this count (default: ${DEFAULT_COMPACTIONS})
  --tool-output-threshold <tokens> Slice when large tool output sum reaches this value (default: ${DEFAULT_TOOL_OUTPUT_TOKENS})
  --max-files <count>              Max important files in the handoff (default: ${DEFAULT_MAX_FILES})
  --output <path>                  Write Markdown handoff to a file instead of stdout
  --include-skill-files            Allow skill package files in important_files
  --orchestrator-board <path>      Mark this as a worker report for a long-goal board
  --worker-id <id>                 Worker id to pair with --orchestrator-board
  --json                           Print compact JSON instead of Markdown
`);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function collectOption(options, key, value) {
  options[key].push(value);
}

function parseArgs(argv) {
  const options = {
    session: null,
    threadId: null,
    cwd: process.cwd(),
    project: null,
    task: 'slice-handoff',
    objective: '',
    stage: '',
    done: [],
    next: [],
    risk: [],
    maxInputThreshold: DEFAULT_MAX_INPUT,
    compactionThreshold: DEFAULT_COMPACTIONS,
    toolOutputThreshold: DEFAULT_TOOL_OUTPUT_TOKENS,
    maxFiles: DEFAULT_MAX_FILES,
    output: null,
    includeSkillFiles: false,
    orchestratorBoard: '',
    workerId: '',
    json: false,
    home: os.homedir(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--session') {
      options.session = expandHome(argv[++index], options.home);
      continue;
    }
    if (arg === '--thread-id') {
      options.threadId = argv[++index];
      continue;
    }
    if (arg === '--cwd') {
      options.cwd = path.resolve(expandHome(argv[++index], options.home));
      continue;
    }
    if (arg === '--project') {
      options.project = argv[++index];
      continue;
    }
    if (arg === '--task') {
      options.task = sanitizeName(argv[++index] || options.task);
      continue;
    }
    if (arg === '--objective') {
      options.objective = argv[++index] || '';
      continue;
    }
    if (arg === '--stage') {
      options.stage = argv[++index] || '';
      continue;
    }
    if (arg === '--done') {
      collectOption(options, 'done', argv[++index] || '');
      continue;
    }
    if (arg === '--next') {
      collectOption(options, 'next', argv[++index] || '');
      continue;
    }
    if (arg === '--risk') {
      collectOption(options, 'risk', argv[++index] || '');
      continue;
    }
    if (arg === '--max-input-threshold') {
      options.maxInputThreshold = parsePositiveInt(argv[++index], options.maxInputThreshold);
      continue;
    }
    if (arg === '--compaction-threshold') {
      options.compactionThreshold = parsePositiveInt(argv[++index], options.compactionThreshold);
      continue;
    }
    if (arg === '--tool-output-threshold') {
      options.toolOutputThreshold = parsePositiveInt(argv[++index], options.toolOutputThreshold);
      continue;
    }
    if (arg === '--max-files') {
      options.maxFiles = parsePositiveInt(argv[++index], options.maxFiles);
      continue;
    }
    if (arg === '--output') {
      options.output = path.resolve(expandHome(argv[++index], options.home));
      continue;
    }
    if (arg === '--include-skill-files') {
      options.includeSkillFiles = true;
      continue;
    }
    if (arg === '--orchestrator-board') {
      options.orchestratorBoard = path.resolve(expandHome(argv[++index], options.home));
      continue;
    }
    if (arg === '--worker-id') {
      options.workerId = sanitizeName(argv[++index] || '');
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    console.error(`Unknown option: ${arg}`);
    usage();
    process.exit(2);
  }

  if (!options.session && !options.threadId) {
    console.error('Provide --session or --thread-id.');
    usage();
    process.exit(2);
  }

  if (!options.project) {
    options.project = path.basename(options.cwd || process.cwd()) || 'codex';
  }

  return options;
}

function expandHome(value, home) {
  if (!value) {
    return value;
  }
  return path.resolve(value.replace(/^~(?=$|\/)/, home));
}

function sanitizeName(value) {
  return String(value || 'slice-handoff').replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '') || 'slice-handoff';
}

function safeJsonParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function walkJsonlFiles(root, matches, needle) {
  if (!fs.existsSync(root)) {
    return;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkJsonlFiles(fullPath, matches, needle);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.jsonl') && entry.name.includes(needle)) {
      matches.push(fullPath);
    }
  }
}

function findSessionByThreadId(threadId, home) {
  const roots = [
    path.join(home, '.codex', 'sessions'),
    path.join(home, '.codex', 'archived_sessions'),
  ];
  const matches = [];
  for (const root of roots) {
    walkJsonlFiles(root, matches, threadId);
  }
  if (matches.length === 0) {
    throw new Error(`No Codex session JSONL found for thread id ${threadId}`);
  }
  matches.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return matches[0];
}

function parseCallArguments(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function summarizeCommand(args) {
  if (!args || typeof args !== 'object') {
    return '';
  }
  if (typeof args.cmd === 'string') {
    return args.cmd;
  }
  if (typeof args.query === 'string') {
    return args.query;
  }
  if (typeof args.objective === 'string') {
    return args.objective;
  }
  return JSON.stringify(args).slice(0, 320);
}

function outputTokenCount(output) {
  const text = String(output || '');
  const originalMatch = text.match(/Original token count:\s*(\d+)/);
  return originalMatch ? Number(originalMatch[1]) : Math.ceil(text.length / 4);
}

function exitCode(output) {
  const match = String(output || '').match(/Process exited with code\s+(-?\d+)/);
  return match ? Number(match[1]) : null;
}

function textFromContent(content) {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((part) => part?.text || part?.input_text || part?.output_text || '')
    .filter(Boolean)
    .join('\n');
}

function sanitizeMessage(text, limit = 900) {
  const withoutInternal = String(text || '')
    .replace(/<codex_internal_context[\s\S]*?<\/codex_internal_context>/g, '[internal goal context omitted]')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (withoutInternal.length <= limit) {
    return withoutInternal;
  }
  return `${withoutInternal.slice(0, limit - 20).trimEnd()} ...[trimmed]`;
}

function extractPathCandidates(text) {
  const candidates = new Set();
  const regex = /(?:^|[\s(["'`])((?:apps|packages|docs|docs-internal|prisma|scripts|src|test|tests|\.github)\/[A-Za-z0-9_./()[\]@+=:-]+\.[A-Za-z0-9]+|(?:apps|packages|docs|docs-internal|prisma|scripts|src|test|tests|\.github)\/[A-Za-z0-9_./()[\]@+=:-]+)/g;
  let match;
  while ((match = regex.exec(text || '')) !== null) {
    candidates.add(match[1].replace(/[.,;:)\]'"`]+$/g, ''));
  }
  return [...candidates];
}

function readSession(sessionPath) {
  const raw = fs.readFileSync(sessionPath, 'utf8');
  return raw.split(/\n/).filter(Boolean);
}

function auditSession(sessionPath) {
  const lines = readSession(sessionPath);
  const calls = new Map();
  const compactions = [];
  const tokenEvents = [];
  const outputs = [];
  const messages = [];
  const pathHints = new Map();

  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const item = safeJsonParse(lines[index]);
    if (!item) {
      continue;
    }
    const payload = item.payload || {};

    if (item.type === 'compacted' || payload.type === 'contextCompaction') {
      compactions.push({ line: lineNo, timestamp: item.timestamp });
    }

    if (item.type === 'event_msg' && payload.type === 'token_count') {
      const info = payload.info || {};
      const last = info.last_token_usage || {};
      const total = info.total_token_usage || {};
      tokenEvents.push({
        line: lineNo,
        timestamp: item.timestamp,
        last_input: last.input_tokens || 0,
        last_cached: last.cached_input_tokens || 0,
        last_uncached: (last.input_tokens || 0) - (last.cached_input_tokens || 0),
        last_output: last.output_tokens || 0,
        last_total: last.total_tokens || 0,
        cumulative_input: total.input_tokens || 0,
        cumulative_total: total.total_tokens || 0,
        model_context_window: info.model_context_window || null,
      });
      continue;
    }

    if (item.type === 'response_item' && payload.type === 'function_call') {
      const args = parseCallArguments(payload.arguments);
      const command = summarizeCommand(args);
      calls.set(payload.call_id, {
        line: lineNo,
        timestamp: item.timestamp,
        name: payload.name || '',
        args,
        command,
      });
      for (const candidate of extractPathCandidates(command)) {
        addWeightedPath(pathHints, candidate, 2);
      }
      continue;
    }

    if (item.type === 'response_item' && payload.type === 'function_call_output') {
      const call = calls.get(payload.call_id) || {};
      const output = String(payload.output || '');
      outputs.push({
        line: lineNo,
        call_line: call.line || null,
        timestamp: item.timestamp,
        name: call.name || '',
        command: call.command || '',
        tokens: outputTokenCount(output),
        chars: output.length,
        exit_code: exitCode(output),
        log_paths: extractLogPaths(output),
      });
      for (const candidate of extractPathCandidates(output).slice(0, 40)) {
        addWeightedPath(pathHints, candidate, 1);
      }
      continue;
    }

    if (item.type === 'response_item' && payload.type === 'message') {
      const text = textFromContent(payload.content);
      if (!text.trim()) {
        continue;
      }
      messages.push({
        line: lineNo,
        timestamp: item.timestamp,
        role: payload.role || 'unknown',
        text,
      });
      for (const candidate of extractPathCandidates(text)) {
        addWeightedPath(pathHints, candidate, 3);
      }
    }
  }

  const largeToolTokens = outputs
    .filter((output) => output.tokens >= 2000)
    .reduce((total, output) => total + output.tokens, 0);

  return {
    session: sessionPath,
    lines: lines.length,
    compactions,
    tokenEvents,
    outputs,
    messages,
    pathHints,
    largeToolTokens,
  };
}

function extractLogPaths(text) {
  const matches = String(text || '').match(/\/tmp\/codex-tool-runs\/[^\s"'`]+/g) || [];
  return [...new Set(matches.map((item) => item.replace(/:\d+.*$/g, '').replace(/[.,;:)\]]+$/g, '')))];
}

function addWeightedPath(map, filePath, weight) {
  if (!filePath || filePath.includes('node_modules') || filePath.includes('/dist/')) {
    return;
  }
  map.set(filePath, (map.get(filePath) || 0) + weight);
}

function runGit(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) {
    return { ok: false, output: (result.stderr || result.stdout || '').trim() };
  }
  return { ok: true, output: result.stdout.trim() };
}

function gitSummary(cwd) {
  const inside = runGit(cwd, ['rev-parse', '--show-toplevel']);
  if (!inside.ok) {
    return { isGit: false, root: cwd, status: [], changedFiles: [] };
  }
  const root = inside.output.split(/\n/)[0] || cwd;
  const status = runGit(root, ['status', '--short']);
  const changed = runGit(root, ['diff', '--name-only', '--diff-filter=ACMRTUXB']);
  const staged = runGit(root, ['diff', '--cached', '--name-only', '--diff-filter=ACMRTUXB']);
  const untracked = runGit(root, ['ls-files', '--others', '--exclude-standard']);
  const changedFiles = [
    ...splitLines(changed.output),
    ...splitLines(staged.output),
    ...splitLines(untracked.output),
  ];
  return {
    isGit: true,
    root,
    status: splitLines(status.output).slice(0, 80),
    changedFiles: [...new Set(changedFiles)].filter(Boolean),
  };
}

function splitLines(text) {
  return String(text || '').split(/\n/).map((line) => line.trim()).filter(Boolean);
}

function latestTokenSummary(tokenEvents) {
  const last = tokenEvents[tokenEvents.length - 1] || null;
  const maxLastInput = tokenEvents.length ? Math.max(...tokenEvents.map((event) => event.last_input)) : 0;
  const maxUncached = tokenEvents.length ? Math.max(...tokenEvents.map((event) => event.last_uncached)) : 0;
  const over100k = tokenEvents.filter((event) => event.last_input >= 100000).length;
  const over200k = tokenEvents.filter((event) => event.last_input >= 200000).length;
  return {
    count: tokenEvents.length,
    last,
    max_last_input: maxLastInput,
    max_uncached: maxUncached,
    events_over_100k: over100k,
    events_over_200k: over200k,
  };
}

function decideSlice(audit, options, tokenSummary) {
  const triggers = [];
  if (audit.compactions.length >= options.compactionThreshold) {
    triggers.push(`compactions ${audit.compactions.length} >= ${options.compactionThreshold}`);
  }
  if ((tokenSummary.last?.last_input || 0) >= options.maxInputThreshold) {
    triggers.push(`last_input ${tokenSummary.last.last_input} >= ${options.maxInputThreshold}`);
  }
  if (tokenSummary.max_last_input >= options.maxInputThreshold) {
    triggers.push(`max_last_input ${tokenSummary.max_last_input} >= ${options.maxInputThreshold}`);
  }
  if (audit.largeToolTokens >= options.toolOutputThreshold) {
    triggers.push(`large_tool_output_tokens ${audit.largeToolTokens} >= ${options.toolOutputThreshold}`);
  }
  return {
    should_slice: triggers.length > 0,
    triggers,
  };
}

function selectRecentAssistantMessages(messages, count) {
  const assistant = messages.filter((message) => message.role === 'assistant');
  const completionLike = assistant.filter((message) => /F\d{1,4}|阶段|完成|done|下一/.test(message.text));
  const selected = completionLike.slice(-count);
  if (selected.length < Math.min(count, 3)) {
    for (const message of assistant.slice(-count)) {
      if (!selected.some((item) => item.line === message.line)) {
        selected.push(message);
      }
    }
  }
  return selected
    .sort((a, b) => a.line - b.line)
    .slice(-count)
    .map((message) => ({
      line: message.line,
      timestamp: message.timestamp,
      text: sanitizeMessage(message.text, 700),
    }));
}

function selectImportantFiles(audit, git, maxFiles, options = {}) {
  const ranked = new Map();
  for (const file of git.changedFiles || []) {
    const hinted = audit.pathHints.has(file);
    ranked.set(file, (ranked.get(file) || 0) + (hinted ? 50 : 4));
  }
  for (const [file, weight] of audit.pathHints.entries()) {
    ranked.set(file, (ranked.get(file) || 0) + weight);
  }
  return [...ranked.entries()]
    .filter(([file]) => isUsefulFile(file, options))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxFiles)
    .map(([file]) => file);
}

function isUsefulFile(file, options = {}) {
  if (!file || file.length > 220) {
    return false;
  }
  if (/(^|\/)(node_modules|\.git|\.next|dist|build|\.turbo|coverage|\.codegraph|target)(\/|$)/.test(file)) {
    return false;
  }
  if (!options.includeSkillFiles && /^(?:skills|\.codex\/skills|\.claude\/skills|\.agents\/skills|(?:[^/]+\/)*public\/skills)(\/|$)/.test(file)) {
    return false;
  }
  if (options.cwd) {
    try {
      const resolved = path.resolve(options.cwd, file);
      if (!fs.existsSync(resolved)) {
        return false;
      }
      if (fs.statSync(resolved).isDirectory()) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

function commandKind(command) {
  if (/capture-tool-run\.mjs/.test(command)) {
    return 'captured';
  }
  if (/\b(type-check|tsc)\b/.test(command)) {
    return 'type-check';
  }
  if (/\b(jest|vitest|test)\b/.test(command)) {
    return 'test';
  }
  if (/\b(build|turbo)\b/.test(command)) {
    return 'build';
  }
  if (/\bprisma\b/.test(command)) {
    return 'prisma';
  }
  return 'tool';
}

function selectVerification(outputs) {
  const relevant = outputs.filter((output) => {
    const command = output.command || '';
    return /capture-tool-run\.mjs|\b(type-check|tsc|jest|vitest|test|build|prisma|lint)\b/.test(command);
  });
  return relevant.slice(-12).map((output) => ({
    kind: commandKind(output.command),
    line: output.line,
    exit_code: output.exit_code,
    command: truncateOneLine(output.command, 180),
    log_paths: output.log_paths.slice(0, 3),
  }));
}

function truncateOneLine(text, limit) {
  const line = String(text || '').replace(/\s+/g, ' ').trim();
  return line.length <= limit ? line : `${line.slice(0, limit - 14).trimEnd()} ...[trimmed]`;
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function writeDiagnostics(options, payload) {
  const dir = path.join('/tmp/codex-tool-runs', sanitizeName(options.project));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sanitizeName(options.task)}-${nowStamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

function bullet(items, fallback = '- none recorded') {
  const values = items.filter(Boolean);
  if (values.length === 0) {
    return fallback;
  }
  return values.map((item) => `- ${item}`).join('\n');
}

function formatToken(value) {
  return Number.isFinite(value) ? String(value) : '0';
}

function renderMarkdown(result) {
  const {
    options,
    session,
    decision,
    tokenSummary,
    git,
    recentMessages,
    importantFiles,
    verification,
    diagnosticsLog,
  } = result;
  const last = tokenSummary.last || {};
  const objective = options.objective || 'Continue the current Codex task from the state below; do not carry the prior full conversation.';
  const stage = options.stage || inferStage(recentMessages) || 'not specified';
  const importantFileSet = new Set(importantFiles);
  const statusForHandoff = filterStatusForHandoff(git.status, options, importantFileSet);
  const changedStatus = statusForHandoff.visible.length
    ? [
        ...statusForHandoff.visible.slice(0, 18).map((line) => `- ${line}`),
        statusForHandoff.omitted > 0 ? `- omitted ${statusForHandoff.omitted} noisy or unrelated status entries; see diagnostics log for full status` : '',
      ].filter(Boolean).join('\n')
    : (statusForHandoff.omitted > 0
        ? `- omitted ${statusForHandoff.omitted} noisy or unrelated status entries; see diagnostics log for full status`
        : '- clean or unavailable');
  const verificationText = verification.length
    ? verification.map((item) => {
        const status = item.exit_code === null ? 'status unknown' : `exit ${item.exit_code}`;
        const logs = item.log_paths.length ? `; logs: ${item.log_paths.join(', ')}` : '';
        return `- ${item.kind}: ${status}; ${item.command}${logs}`;
      }).join('\n')
    : '- none detected in recent session outputs';
  const recentText = recentMessages.length
    ? recentMessages.map((message) => `- session line ${message.line}: ${message.text.replace(/\n/g, '\n  ')}`).join('\n')
    : '- no compact assistant milestone messages detected';
  const orchestrated = Boolean(options.orchestratorBoard);
  const workerId = options.workerId || 'unspecified-worker';
  const orchestrationText = orchestrated
    ? `## Orchestrated Worker Report
- orchestrator_board: ${options.orchestratorBoard}
- worker_id: ${workerId}
- rule: report this handoff to the orchestrator board; do not recursively create a successor worker thread from this worker.
`
    : '';
  const starterPrompt = orchestrated
    ? `/goal Continue exactly this orchestrated worker slice from the handoff below, report the result to the board, and stop.

Board: ${options.orchestratorBoard}
Worker id: ${workerId}
Handoff: ${options.output || session}

Worker continuation rule: this prompt is only for resuming the same assigned worker slice if the orchestrator intentionally restarts it. Do not create successor worker threads. If session health again returns wrap_and_split, generate a compact handoff, update the board with status handoff_required, and stop. Do not use update_goal(status="blocked") merely to split or save tokens.

Objective: ${objective}
Current stage: ${stage}
Next work: ${options.next.length ? options.next.join('; ') : 'finish only the assigned worker slice'}
Important files: ${importantFiles.slice(0, 10).join(', ') || 'inspect current repo state first'}
Verification evidence: ${verification.length ? verification.map((item) => `${item.kind} ${item.exit_code === null ? 'unknown' : `exit ${item.exit_code}`}`).join('; ') : 'none supplied'}

Respect the carry rules above. Start by checking git status and the specific files needed for this worker only.`
    : `/goal Continue the Codex work using only this handoff as prior context. Do not read old sessions.

Continuation rule: keep the broader objective moving in small verified slices. After each completed slice, run the repo/session health check. If it returns wrap_and_split, generate a compact handoff and stop. Do not create another continuation thread unless the current user message explicitly asks this agent to create/start/open it now, or this thread is an orchestrator creating a board-managed worker. Authorization does not carry forward through handoffs or starter prompts. Do not use update_goal(status="blocked") merely to split or save tokens.

Objective: ${objective}
Current stage: ${stage}
Next work: ${options.next.length ? options.next.join('; ') : 'choose the next smallest verifiable slice from the current project state'}
Important files: ${importantFiles.slice(0, 10).join(', ') || 'inspect current repo state first'}
Verification evidence: ${verification.length ? verification.map((item) => `${item.kind} ${item.exit_code === null ? 'unknown' : `exit ${item.exit_code}`}`).join('; ') : 'none supplied'}

Respect the carry rules above. Start by checking git status and the specific files needed for the next slice only.`;

  return `# Codex Slice Handoff

## Slice Decision
- should_slice: ${decision.should_slice ? 'yes' : 'no'}
- triggers: ${decision.triggers.length ? decision.triggers.join('; ') : 'none'}
- diagnostics_log: ${diagnosticsLog}

## Minimal Continuation Context
- objective: ${objective}
- current_stage: ${stage}
- session: ${session}
- cwd: ${options.cwd}

${orchestrationText}
## Token And Session Facts
- compactions: ${result.compactions.length}
- token_events: ${tokenSummary.count}
- last_input: ${formatToken(last.last_input)}
- max_last_input: ${formatToken(tokenSummary.max_last_input)}
- max_uncached_input: ${formatToken(tokenSummary.max_uncached)}
- events_over_100k_input: ${tokenSummary.events_over_100k}
- events_over_200k_input: ${tokenSummary.events_over_200k}
- large_tool_output_tokens: ${result.largeToolTokens}

## Completed Or Current Work
${bullet(options.done)}

## Recent Milestones From Thread
${recentText}

## Next Work
${bullet(options.next, '- infer the next smallest verifiable slice from the current TODO/roadmap, then update this handoff before continuing')}

## Important Files
${bullet(importantFiles)}

## Git Status Snapshot
${changedStatus}

## Verification Evidence
${verificationText}

## Known Gaps And Risks
${bullet(options.risk)}

## Carry Rules
- Carry only this handoff, the listed files, and referenced log paths into the next slice.
- Do not carry raw tool logs, full diffs, full roadmap/TODO documents, full SKILL.md files, or the previous conversation.
- If a listed file needs inspection, read a narrow symbol or line window only.
- If validation is needed, capture full output under /tmp/codex-tool-runs/${sanitizeName(options.project)}/ and return only status, key errors, and log path.

## Starter Prompt For New Slice
\`\`\`text
${starterPrompt}
\`\`\`
`;
}

function inferStage(recentMessages) {
  for (const message of [...recentMessages].reverse()) {
    const match = message.text.match(/\bF\d{1,4}(?:\.\d+)?\b/);
    if (match) {
      return match[0];
    }
  }
  return '';
}

function filterStatusForHandoff(statusLines, options, importantFileSet = null) {
  const visible = [];
  let omitted = 0;
  for (const line of statusLines || []) {
    const statusPath = extractStatusPath(line);
    if (!statusPath || isNoisyStatusPath(statusPath, options) || (importantFileSet && !importantFileSet.has(statusPath))) {
      omitted += 1;
      continue;
    }
    visible.push(line);
  }
  return { visible, omitted };
}

function extractStatusPath(line) {
  const text = String(line || '').trim();
  if (!text) {
    return '';
  }
  const rawPath = text.slice(2).trim();
  if (rawPath.includes(' -> ')) {
    return rawPath.split(' -> ').pop().trim();
  }
  return rawPath;
}

function isNoisyStatusPath(statusPath, options = {}) {
  if (/(^|\/)(node_modules|\.git|\.next|dist|build|\.turbo|coverage|\.codegraph|target)(\/|$)/.test(statusPath)) {
    return true;
  }
  if (!options.includeSkillFiles && /^(?:skills|\.codex\/skills|\.claude\/skills|\.agents\/skills|(?:[^/]+\/)*public\/skills)(\/|$)/.test(statusPath)) {
    return true;
  }
  return false;
}

function buildResult(options) {
  const session = options.session || findSessionByThreadId(options.threadId, options.home);
  const audit = auditSession(session);
  const tokens = latestTokenSummary(audit.tokenEvents);
  const decision = decideSlice(audit, options, tokens);
  const git = gitSummary(options.cwd);
  const recentMessages = selectRecentAssistantMessages(audit.messages, DEFAULT_RECENT_MESSAGES);
  const importantFiles = selectImportantFiles(audit, git, options.maxFiles, {
    includeSkillFiles: options.includeSkillFiles,
    cwd: options.cwd,
  });
  const verification = selectVerification(audit.outputs);
  const compactDiagnostics = {
    task: 'codex-slice-handoff',
    status: 'generated',
    session,
    cwd: options.cwd,
    decision,
    orchestration: options.orchestratorBoard ? {
      orchestrator_board: options.orchestratorBoard,
      worker_id: options.workerId || 'unspecified-worker',
      mode: 'worker-report',
    } : null,
    compactions: audit.compactions,
    token_summary: tokens,
    large_tool_output_tokens: audit.largeToolTokens,
    top_tool_outputs: [...audit.outputs].sort((a, b) => b.tokens - a.tokens).slice(0, 20),
    recent_messages: recentMessages,
    important_files: importantFiles,
    git_status: git.status,
    verification,
  };
  const diagnosticsLog = writeDiagnostics(options, compactDiagnostics);
  return {
    options,
    session,
    decision,
    tokenSummary: tokens,
    compactions: audit.compactions,
    largeToolTokens: audit.largeToolTokens,
    git,
    recentMessages,
    importantFiles,
    verification,
    diagnosticsLog,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = buildResult(options);
  if (options.json) {
    const json = JSON.stringify({
      should_slice: result.decision.should_slice,
      triggers: result.decision.triggers,
      diagnostics_log: result.diagnosticsLog,
      session: result.session,
      token_summary: result.tokenSummary,
      compactions: result.compactions.length,
      orchestration: options.orchestratorBoard ? {
        orchestrator_board: options.orchestratorBoard,
        worker_id: options.workerId || 'unspecified-worker',
        mode: 'worker-report',
      } : null,
      important_files: result.importantFiles,
      verification: result.verification,
    }, null, 2);
    if (options.output) {
      fs.writeFileSync(options.output, json);
    } else {
      console.log(json);
    }
    return;
  }

  const markdown = renderMarkdown(result);
  if (options.output) {
    fs.writeFileSync(options.output, markdown);
    console.log(JSON.stringify({
      task: 'codex-slice-handoff',
      status: 'written',
      should_slice: result.decision.should_slice,
      output: options.output,
      diagnostics_log: result.diagnosticsLog,
      orchestration: options.orchestratorBoard ? {
        orchestrator_board: options.orchestratorBoard,
        worker_id: options.workerId || 'unspecified-worker',
        mode: 'worker-report',
      } : null,
    }, null, 2));
    return;
  }
  console.log(markdown);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
