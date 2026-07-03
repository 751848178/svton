#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function usage() {
  console.error(`Usage:
  token-guard.mjs [--project <name>] [--cwd <path>] --command <shell-command>

Examples:
  token-guard.mjs --project svton --cwd /repo --command 'rg -n "server_agent" apps docs-internal'
  token-guard.mjs --command "git diff -- apps/devpilot-api/src docs-internal"
`);
}

function parseArgs(argv) {
  const options = {
    project: path.basename(process.cwd()),
    cwd: process.cwd(),
    command: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--project') {
      options.project = argv[++index];
      continue;
    }
    if (arg === '--cwd') {
      options.cwd = path.resolve(argv[++index]);
      continue;
    }
    if (arg === '--command') {
      options.command = argv[++index];
      continue;
    }
    console.error(`Unknown option: ${arg}`);
    usage();
    process.exit(2);
  }

  if (!options.command) {
    console.error('Missing --command');
    usage();
    process.exit(2);
  }

  return options;
}

function quoteArg(arg) {
  return /^[A-Za-z0-9_/:=.,@%+-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`;
}

export function shellTokens(command) {
  const tokens = [];
  let current = '';
  let quote = null;
  let escaped = false;

  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      current += char;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function scriptPath(name) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, name);
}

export function extractRgShape(tokens) {
  const first = tokens[0];
  if (!['rg', 'grep', 'find'].includes(first)) {
    return null;
  }
  const paths = [];
  const globs = [];
  let hasFilesOnly = false;
  let hasCountOnly = false;
  let hasMaxCount = false;
  let searchesJsonl = false;
  let afterDoubleDash = false;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--') {
      afterDoubleDash = true;
      continue;
    }
    if (token === '-g' || token === '--glob') {
      globs.push(tokens[++index] ?? '');
      continue;
    }
    if (token === '-l' || token === '--files-with-matches') {
      hasFilesOnly = true;
      continue;
    }
    if (token === '--count' || token === '--count-matches') {
      hasCountOnly = true;
      continue;
    }
    if (token === '-m' || token === '--max-count' || token.startsWith('--max-count=')) {
      hasMaxCount = true;
      if (token === '-m' || token === '--max-count') {
        index += 1;
      }
      continue;
    }
    if (token.includes('.jsonl')) {
      searchesJsonl = true;
    }
    if (token.startsWith('-') && !afterDoubleDash) {
      continue;
    }
    if (index > 1 || first !== 'find') {
      paths.push(token);
    }
  }

  const heavyPathNames = ['.', 'apps', 'packages', 'docs', 'docs-internal', 'prisma', 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.codegraph'];
  const broadPaths = paths.filter((candidate) => heavyPathNames.includes(candidate) || candidate.includes('/node_modules') || candidate.includes('/.next') || candidate.includes('/dist'));
  const hasGeneratedExcludes = globs.some((glob) => /node_modules|\.next|dist|build|target|coverage|\.turbo|\.codegraph/.test(glob));

  return {
    command: first,
    paths,
    globs,
    broad: first === 'find' || paths.length > 2 || broadPaths.length > 0,
    bounded: hasFilesOnly || hasCountOnly || hasMaxCount,
    hasGeneratedExcludes,
    searchesJsonl,
  };
}

export function parseSedRange(command) {
  const range = command.match(/sed\s+-n\s+['"]?(\d+),(\d+)p['"]?/);
  if (!range) {
    return null;
  }
  const start = Number.parseInt(range[1], 10);
  const end = Number.parseInt(range[2], 10);
  return { start, end, lines: Number.isFinite(start) && Number.isFinite(end) ? end - start + 1 : null };
}

export function parseTailLines(command) {
  const match = command.match(/tail\s+-n\s+(\d+)/);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

export function analyze(options) {
  const normalized = options.command.trim().replace(/\s+/g, ' ');
  const tokens = shellTokens(normalized);
  const violations = [];
  const recommended = [];

  const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const smartRg = scriptPath('smart-rg.mjs');
  const safeRead = scriptPath('safe-read.mjs');
  const diffSummary = scriptPath('diff-summary.mjs');
  const sessionAudit = scriptPath('codex-session-token-audit.mjs');
  const progressSnapshot = scriptPath('progress-snapshot.mjs');

  const searchShape = extractRgShape(tokens);
  if (searchShape) {
    if (searchShape.searchesJsonl) {
      violations.push('session-jsonl-search');
      recommended.push({
        tool: 'codex-session-token-audit',
        reason: 'Searches over Codex/Claude JSONL can return whole prompt/tool-output lines.',
        command: `node ${quoteArg(sessionAudit)} --session <path-to-session.jsonl>`,
      });
    } else if (searchShape.broad && !searchShape.bounded) {
      violations.push('raw-broad-search');
      recommended.push({
        tool: 'smart-rg',
        reason: 'Broad search should return counts, matched files, and bounded samples.',
        command: `node ${quoteArg(smartRg)} --project ${quoteArg(options.project)} --task <task-name> --cwd ${quoteArg(options.cwd)} -- <pattern> <paths...>`,
      });
    }
    if (searchShape.broad && !searchShape.hasGeneratedExcludes) {
      violations.push('missing-generated-excludes');
    }
  }

  if (/^git diff\b/.test(normalized) && !/\b(--stat|--name-status|--numstat|--check|--shortstat|--quiet)\b/.test(normalized)) {
    violations.push('raw-git-diff');
    recommended.push({
      tool: 'diff-summary',
      reason: 'Full diffs should go to a log; main context should receive stat/name-status/numstat/check summaries.',
      command: `node ${quoteArg(diffSummary)} --project ${quoteArg(options.project)} --task <task-name> --cwd ${quoteArg(options.cwd)} -- <paths...>`,
    });
  }

  const sedRange = parseSedRange(normalized);
  if (sedRange?.lines && sedRange.lines > 120) {
    violations.push('large-sed-window');
    recommended.push({
      tool: 'safe-read',
      reason: `sed window reads ${sedRange.lines} lines; default max is 120 lines per window.`,
      command: `node ${quoteArg(safeRead)} --cwd ${quoteArg(options.cwd)} --file <file> --start ${sedRange.start} --end ${sedRange.end}`,
    });
  }

  const tailLines = parseTailLines(normalized);
  if (tailLines && tailLines > 120) {
    violations.push('large-tail-window');
    recommended.push({
      tool: 'progress-snapshot',
      reason: 'Large tail reads on TODO/roadmap documents should return status lines and headings, not raw document tails.',
      command: `node ${quoteArg(progressSnapshot)} --project ${quoteArg(options.project)} --cwd ${quoteArg(options.cwd)} --task <task-name> --keyword <feature-or-F-id>`,
    });
  }

  if (/^cat\b/.test(normalized) && !/SKILL\.md$/.test(normalized)) {
    violations.push('raw-cat');
    recommended.push({
      tool: 'safe-read',
      reason: 'cat can load full files; use bounded line or pattern windows unless the file is known tiny.',
      command: `node ${quoteArg(safeRead)} --cwd ${quoteArg(options.cwd)} --file <file> --pattern <symbol-or-keyword>`,
    });
  }

  if (/\/tmp\/codex-tool-runs/.test(normalized) && (/sed\s+-n/.test(normalized) || /tail\s+-n/.test(normalized) || /^cat\b/.test(normalized))) {
    const logWindow = sedRange?.lines ?? tailLines ?? 999;
    if (logWindow > 80 || /^cat\b/.test(normalized)) {
      violations.push('large-log-reread');
    }
  }

  if (/docs-internal\/(todos|devpilot)/.test(normalized) && (/tail\s+-n/.test(normalized) || /sed\s+-n\s+['"]?1,/.test(normalized))) {
    violations.push('progress-doc-raw-read');
    recommended.push({
      tool: 'progress-snapshot',
      reason: 'Repeated TODO/roadmap reads should use compact status extraction.',
      command: `node ${quoteArg(progressSnapshot)} --project ${quoteArg(options.project)} --cwd ${quoteArg(options.cwd)} --task devpilot-progress --keyword <F-id-or-topic>`,
    });
  }

  const risk = violations.some((item) => ['raw-broad-search', 'raw-git-diff', 'session-jsonl-search', 'large-log-reread'].includes(item))
    ? 'high'
    : violations.length > 0
      ? 'medium'
      : 'low';

  return {
    task: 'token-guard',
    status: violations.length > 0 ? 'route_to_compact_tool' : 'ok',
    risk,
    cwd: options.cwd,
    command: normalized,
    skill_root: skillRoot,
    violations: [...new Set(violations)],
    recommended_tools: recommended,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    console.log(JSON.stringify(analyze(options), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  }
}
