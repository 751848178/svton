#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function usage() {
  console.error(`Usage:
  codex-session-token-audit.mjs --session <path-to-rollout.jsonl> [--top <n>]
  codex-session-token-audit.mjs --thread-id <codex-thread-id> [--top <n>]

Examples:
  codex-session-token-audit.mjs --thread-id 019f0eca-26ba-7d00-a6b0-98c56770e0e3
  codex-session-token-audit.mjs --session ~/.codex/sessions/2026/06/28/rollout-...jsonl
  codex-session-token-audit.mjs --session ~/.claude/projects/example/session.jsonl
`);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv) {
  const options = {
    session: null,
    threadId: null,
    top: 12,
    home: os.homedir(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--session') {
      options.session = path.resolve(argv[++index].replace(/^~(?=$|\/)/, options.home));
      continue;
    }
    if (arg === '--thread-id') {
      options.threadId = argv[++index];
      continue;
    }
    if (arg === '--top') {
      options.top = parsePositiveInt(argv[++index], options.top);
      continue;
    }
    console.error(`Unknown option: ${arg}`);
    usage();
    process.exit(2);
  }

  if (!options.session && !options.threadId) {
    console.error('Provide --session or --thread-id');
    usage();
    process.exit(2);
  }

  return options;
}

function walkJsonlFiles(root, matches, needle) {
  if (!fs.existsSync(root)) {
    return;
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
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

function safeJsonParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
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
  if (typeof args.ref_id === 'string') {
    return args.ref_id;
  }
  if (typeof args.filePath === 'string') {
    return args.filePath;
  }
  return JSON.stringify(args).slice(0, 240);
}

function addCount(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function findUsage(item) {
  const candidates = [
    item.usage,
    item.message?.usage,
    item.payload?.usage,
    item.payload?.message?.usage,
    item.payload?.response?.usage,
  ];
  return candidates.find((candidate) => candidate && (
    Number.isFinite(candidate.input_tokens) ||
    Number.isFinite(candidate.cache_creation_input_tokens) ||
    Number.isFinite(candidate.cache_read_input_tokens) ||
    Number.isFinite(candidate.output_tokens)
  ));
}

function usageInput(usage) {
  const input = usage.input_tokens || 0;
  const cacheCreate = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  return input + cacheCreate + cacheRead;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function topBy(items, key, count) {
  return [...items].sort((a, b) => b[key] - a[key]).slice(0, count);
}

function auditSession(sessionPath, topCount) {
  const raw = fs.readFileSync(sessionPath, 'utf8');
  const lines = raw.split(/\n/).filter(Boolean);
  const calls = new Map();
  const tokenEvents = [];
  const outputs = [];
  const rawLineSizes = [];
  const eventTypes = {};
  const itemTypes = {};
  const compactions = [];
  const runningUsage = {
    input: 0,
    cached: 0,
    output: 0,
    total: 0,
  };

  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const line = lines[index];
    rawLineSizes.push({
      line: lineNo,
      chars: line.length,
      approx_tokens: Math.round(line.length / 4),
    });

    const item = safeJsonParse(line);
    if (!item) {
      continue;
    }

    addCount(eventTypes, item.type || 'unknown');
    const payload = item.payload || {};
    if (item.type === 'response_item') {
      addCount(itemTypes, payload.type || 'unknown');
    }

    if (item.type === 'compacted' || payload.type === 'contextCompaction') {
      compactions.push({ line: lineNo, timestamp: item.timestamp, type: item.type || payload.type });
    }

    if (item.type === 'event_msg' && payload.type === 'token_count') {
      const info = payload.info || {};
      const last = info.last_token_usage || {};
      const total = info.total_token_usage || {};
      tokenEvents.push({
        source: 'codex_token_count',
        line: lineNo,
        timestamp: item.timestamp,
        last_input: last.input_tokens || 0,
        last_cached: last.cached_input_tokens || 0,
        last_uncached: (last.input_tokens || 0) - (last.cached_input_tokens || 0),
        last_output: last.output_tokens || 0,
        last_reasoning: last.reasoning_output_tokens || 0,
        last_total: last.total_tokens || 0,
        cumulative_input: total.input_tokens || 0,
        cumulative_cached: total.cached_input_tokens || 0,
        cumulative_output: total.output_tokens || 0,
        cumulative_reasoning: total.reasoning_output_tokens || 0,
        cumulative_total: total.total_tokens || 0,
        model_context_window: info.model_context_window || null,
      });
      continue;
    }

    const usage = findUsage(item);
    if (usage) {
      const lastInput = usageInput(usage);
      const lastCached = usage.cache_read_input_tokens || usage.cached_input_tokens || 0;
      const lastOutput = usage.output_tokens || 0;
      const lastTotal = lastInput + lastOutput;
      runningUsage.input += lastInput;
      runningUsage.cached += lastCached;
      runningUsage.output += lastOutput;
      runningUsage.total += lastTotal;
      tokenEvents.push({
        source: 'generic_usage',
        line: lineNo,
        timestamp: item.timestamp,
        last_input: lastInput,
        last_cached: lastCached,
        last_uncached: lastInput - lastCached,
        last_output: lastOutput,
        last_reasoning: usage.reasoning_output_tokens || 0,
        last_total: lastTotal,
        cumulative_input: runningUsage.input,
        cumulative_cached: runningUsage.cached,
        cumulative_output: runningUsage.output,
        cumulative_reasoning: 0,
        cumulative_total: runningUsage.total,
        model_context_window: null,
      });
    }

    if (item.type === 'response_item' && payload.type === 'function_call') {
      let args = {};
      try {
        args = JSON.parse(payload.arguments || '{}');
      } catch {
        args = {};
      }
      calls.set(payload.call_id, {
        line: lineNo,
        name: payload.name || '',
        namespace: payload.namespace || '',
        args,
      });
      continue;
    }

    if (item.type === 'response_item' && payload.type === 'function_call_output') {
      const call = calls.get(payload.call_id) || {};
      const output = String(payload.output || '');
      const originalTokenMatch = output.match(/Original token count: (\d+)/);
      outputs.push({
        line: lineNo,
        call_line: call.line || null,
        name: call.name || '',
        namespace: call.namespace || '',
        output_chars: output.length,
        approx_output_tokens: Math.round(output.length / 4),
        original_token_count: originalTokenMatch ? Number(originalTokenMatch[1]) : null,
        command: summarizeCommand(call.args).slice(0, 260),
      });
    }
  }

  const first = tokenEvents[0] || null;
  const last = tokenEvents[tokenEvents.length - 1] || null;
  const tokenAgg = {
    count: tokenEvents.length,
    first,
    last,
    sum_last_input: sum(tokenEvents.map((event) => event.last_input)),
    sum_last_cached: sum(tokenEvents.map((event) => event.last_cached)),
    sum_last_uncached_input: sum(tokenEvents.map((event) => event.last_uncached)),
    max_last_input: tokenEvents.length ? Math.max(...tokenEvents.map((event) => event.last_input)) : 0,
    max_last_total: tokenEvents.length ? Math.max(...tokenEvents.map((event) => event.last_total)) : 0,
    events_over_50k_input: tokenEvents.filter((event) => event.last_input >= 50000).length,
    events_over_100k_input: tokenEvents.filter((event) => event.last_input >= 100000).length,
  };

  return {
    task: 'codex-session-token-audit',
    status: 'audited',
    session: sessionPath,
    lines: lines.length,
    event_types: eventTypes,
    response_item_types: itemTypes,
    compactions,
    token_aggregate: tokenAgg,
    top_token_events: topBy(tokenEvents, 'last_total', topCount),
    top_tool_outputs_by_original_tokens: topBy(
      outputs.filter((output) => output.original_token_count !== null),
      'original_token_count',
      topCount,
    ),
    top_tool_outputs_by_returned_size: topBy(outputs, 'approx_output_tokens', topCount),
    top_raw_json_lines: topBy(rawLineSizes, 'chars', topCount),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const sessionPath = options.session || findSessionByThreadId(options.threadId, options.home);
  const result = auditSession(sessionPath, options.top);
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
