#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_STATUS_PATTERN = '下一步|待补|未完成|blockedBy';
const DEFAULT_PROGRESS_FILES = [
  'docs/todos.md',
  'docs/todos/INDEX.md',
  'docs/roadmap.md',
  'docs/roadmap/INDEX.md',
  'docs/requirements.md',
  'docs/progress.md',
  'TODO.md',
  'ROADMAP.md',
  'REQUIREMENTS.md',
];

function usage() {
  console.error(`Usage:
  progress-snapshot.mjs [--project <name>] [--task <name>] [--cwd <path>]
    [--file <path>] [--keyword <text-or-regex>] [--status-regex <regex>]
    [--max-items <n>] [--context <n>]

Examples:
  progress-snapshot.mjs --project my-project --cwd /path/to/repo --task progress --keyword TASK-123 --file docs/todos/platform.md
  PROGRESS_SNAPSHOT_FILES="docs/todos/platform.md:docs/roadmap.md" progress-snapshot.mjs --cwd /path/to/repo --keyword feature-id --context 1
`);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv) {
  const options = {
    project: path.basename(process.cwd()),
    task: 'progress-snapshot',
    cwd: process.cwd(),
    files: [],
    keywords: [],
    statusRegex: DEFAULT_STATUS_PATTERN,
    maxItems: 80,
    context: 0,
    maxTextChars: 220,
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
    if (arg === '--task') {
      options.task = argv[++index];
      continue;
    }
    if (arg === '--cwd') {
      options.cwd = path.resolve(argv[++index]);
      continue;
    }
    if (arg === '--file') {
      options.files.push(argv[++index]);
      continue;
    }
    if (arg === '--keyword') {
      options.keywords.push(argv[++index]);
      continue;
    }
    if (arg === '--status-regex') {
      options.statusRegex = argv[++index];
      continue;
    }
    if (arg === '--max-items') {
      options.maxItems = parsePositiveInt(argv[++index], options.maxItems);
      continue;
    }
    if (arg === '--context') {
      options.context = parsePositiveInt(argv[++index], options.context);
      continue;
    }
    if (arg === '--max-text-chars') {
      options.maxTextChars = parsePositiveInt(argv[++index], options.maxTextChars);
      continue;
    }
    console.error(`Unknown option: ${arg}`);
    usage();
    process.exit(2);
  }

  return options;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileRegex(value, fallbackFlags = 'i') {
  try {
    return new RegExp(value, fallbackFlags);
  } catch {
    return new RegExp(escapeRegExp(value), fallbackFlags);
  }
}

function splitPathList(value) {
  return String(value ?? '')
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultFiles(cwd) {
  const configured = splitPathList(process.env.PROGRESS_SNAPSHOT_FILES);
  const candidates = configured.length > 0 ? configured : DEFAULT_PROGRESS_FILES;
  return candidates.filter((file) => fs.existsSync(path.resolve(cwd, file)));
}

function headingForLine(headingStack) {
  if (headingStack.length === 0) {
    return null;
  }
  return headingStack.map((heading) => heading.text).join(' > ');
}

function hasStatusSignal(text, statusRegex) {
  const tableMatch = text.match(/^\|\s*[^|]+\|\s*([^|]+)\|/);
  if (tableMatch) {
    return /\b(pending|in_progress|blocked)\b/i.test(tableMatch[1]);
  }
  const hit = statusRegex.test(text);
  statusRegex.lastIndex = 0;
  return hit;
}

function pushItem(items, seen, item, maxItems) {
  const key = `${item.file}:${item.line}:${item.reason}`;
  if (seen.has(key) || items.length >= maxItems) {
    return;
  }
  seen.add(key);
  items.push(item);
}

function summarizeFile(relativeFile, options, regexes, statusRegex) {
  const absoluteFile = path.resolve(options.cwd, relativeFile);
  const raw = fs.readFileSync(absoluteFile, 'utf8');
  const lines = raw.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  const items = [];
  const seen = new Set();
  const headingStack = [];
  let statusMatches = 0;
  let keywordMatches = 0;
  let fHeadingCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index] ?? '';
    const lineNo = index + 1;
    const heading = text.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      const level = heading[1].length;
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, text: heading[2].trim(), line: lineNo });
      if (/\bF[0-9][0-9.]*/.test(heading[2])) {
        fHeadingCount += 1;
      }
    }

    const statusHit = hasStatusSignal(text, statusRegex);
    const keywordHits = regexes.filter((regex) => {
      const hit = regex.test(text);
      regex.lastIndex = 0;
      return hit;
    });

    const includeStatusOnly = regexes.length === 0;
    if (keywordHits.length === 0 && (!includeStatusOnly || !statusHit)) {
      continue;
    }

    if (statusHit) {
      statusMatches += 1;
    }
    if (keywordHits.length > 0) {
      keywordMatches += 1;
    }

    const reason = keywordHits.length > 0
      ? `keyword:${keywordHits.map((regex) => regex.source).join('|')}`
      : 'status';

    pushItem(items, seen, {
      file: relativeFile,
      line: lineNo,
      reason,
      heading: headingForLine(headingStack),
      text: text.trim().slice(0, options.maxTextChars),
    }, options.maxItems);

    for (let offset = 1; offset <= options.context; offset += 1) {
      const before = index - offset;
      const after = index + offset;
      if (before >= 0) {
        pushItem(items, seen, {
          file: relativeFile,
          line: before + 1,
          reason: `${reason}:context`,
          heading: headingForLine(headingStack),
          text: (lines[before] ?? '').trim().slice(0, options.maxTextChars),
        }, options.maxItems);
      }
      if (after < lines.length) {
        pushItem(items, seen, {
          file: relativeFile,
          line: after + 1,
          reason: `${reason}:context`,
          heading: headingForLine(headingStack),
          text: (lines[after] ?? '').trim().slice(0, options.maxTextChars),
        }, options.maxItems);
      }
    }
  }

  return {
    file: relativeFile,
    absolute_file: absoluteFile,
    total_lines: lines.length,
    status_matches: statusMatches,
    keyword_matches: keywordMatches,
    f_heading_count: fHeadingCount,
    items,
    items_truncated: statusMatches + keywordMatches > items.length,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = options.files.length > 0 ? options.files : defaultFiles(options.cwd);
  const statusRegex = compileRegex(options.statusRegex, 'i');
  const regexes = options.keywords.map((keyword) => compileRegex(keyword, 'i'));

  const summaries = [];
  const missing = [];
  let remainingItems = options.maxItems;

  for (const file of files) {
    const absoluteFile = path.resolve(options.cwd, file);
    if (!fs.existsSync(absoluteFile)) {
      missing.push(file);
      continue;
    }
    const fileSummary = summarizeFile(file, { ...options, maxItems: remainingItems }, regexes, statusRegex);
    summaries.push(fileSummary);
    remainingItems = Math.max(0, remainingItems - fileSummary.items.length);
    if (remainingItems === 0) {
      break;
    }
  }

  const totalItems = summaries.reduce((sum, summary) => sum + summary.items.length, 0);
  const result = {
    task: options.task,
    status: files.length === 0 ? 'no_files' : 'summarized',
    project: options.project,
    cwd: options.cwd,
    files_requested: files,
    missing_files: missing,
    keywords: options.keywords,
    status_regex: options.statusRegex,
    max_items: options.maxItems,
    total_items: totalItems,
    files: summaries,
    next_step: totalItems === 0
      ? 'Use --keyword <F-id-or-topic> or --file <path> to narrow a specific progress document.'
      : 'Inspect exact line windows with safe-read.mjs only for the few listed file:line anchors needed.',
  };

  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
}
