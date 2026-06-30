#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error(`Usage:
  safe-read.mjs --file <path> [--cwd <path>] [--start <line> --end <line>]
  safe-read.mjs --file <path> [--cwd <path>] --pattern <regex-or-text> [--fixed] [--before <n>] [--after <n>] [--max-matches <n>]

Examples:
  safe-read.mjs --file src/service.ts --start 120 --end 200
  safe-read.mjs --file src/service.ts --pattern "autoRollback" --before 40 --after 80
`);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv) {
  const options = {
    cwd: process.cwd(),
    file: null,
    start: null,
    end: null,
    pattern: null,
    fixed: false,
    before: 30,
    after: 70,
    maxLines: 120,
    maxMatches: 5,
    maxChars: 18000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--cwd') {
      options.cwd = path.resolve(argv[++index]);
      continue;
    }
    if (arg === '--file') {
      options.file = argv[++index];
      continue;
    }
    if (arg === '--start') {
      options.start = parsePositiveInt(argv[++index], 1);
      continue;
    }
    if (arg === '--end') {
      options.end = parsePositiveInt(argv[++index], 1);
      continue;
    }
    if (arg === '--pattern') {
      options.pattern = argv[++index];
      continue;
    }
    if (arg === '--fixed' || arg === '-F') {
      options.fixed = true;
      continue;
    }
    if (arg === '--before') {
      options.before = parsePositiveInt(argv[++index], options.before);
      continue;
    }
    if (arg === '--after') {
      options.after = parsePositiveInt(argv[++index], options.after);
      continue;
    }
    if (arg === '--max-lines') {
      options.maxLines = parsePositiveInt(argv[++index], options.maxLines);
      continue;
    }
    if (arg === '--max-matches') {
      options.maxMatches = parsePositiveInt(argv[++index], options.maxMatches);
      continue;
    }
    if (arg === '--max-chars') {
      options.maxChars = parsePositiveInt(argv[++index], options.maxChars);
      continue;
    }
    console.error(`Unknown option: ${arg}`);
    usage();
    process.exit(2);
  }

  if (!options.file) {
    console.error('Missing --file');
    usage();
    process.exit(2);
  }

  return options;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clampWindow(start, end, totalLines, maxLines) {
  let safeStart = Math.max(1, Math.min(start, totalLines || 1));
  let safeEnd = Math.max(safeStart, Math.min(end, totalLines || safeStart));
  const lineCount = safeEnd - safeStart + 1;
  if (lineCount > maxLines) {
    safeEnd = safeStart + maxLines - 1;
  }
  return { start: safeStart, end: safeEnd, truncated: lineCount > maxLines };
}

function mergeWindows(windows, maxLines) {
  const sorted = [...windows].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const window of sorted) {
    const last = merged[merged.length - 1];
    if (last && window.start <= last.end + 1) {
      last.end = Math.max(last.end, window.end);
      last.truncated = last.truncated || window.truncated || (last.end - last.start + 1 > maxLines);
      if (last.end - last.start + 1 > maxLines) {
        last.end = last.start + maxLines - 1;
      }
    } else {
      merged.push({ ...window });
    }
  }
  return merged;
}

function windowText(lines, start, end, maxChars) {
  const selected = [];
  let chars = 0;
  let truncated = false;
  for (let lineNo = start; lineNo <= end; lineNo += 1) {
    const text = `${String(lineNo).padStart(5, ' ')}: ${lines[lineNo - 1] ?? ''}`;
    if (chars + text.length + 1 > maxChars) {
      truncated = true;
      break;
    }
    selected.push(text);
    chars += text.length + 1;
  }
  return { text: selected.join('\n'), chars, truncated };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const absoluteFile = path.resolve(options.cwd, options.file);
  const raw = fs.readFileSync(absoluteFile, 'utf8');
  const lines = raw.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  const windows = [];
  const matches = [];

  if (options.pattern) {
    const pattern = options.fixed ? escapeRegExp(options.pattern) : options.pattern;
    const regex = new RegExp(pattern);
    for (let index = 0; index < lines.length; index += 1) {
      if (!regex.test(lines[index])) {
        continue;
      }
      const lineNo = index + 1;
      matches.push({ line: lineNo, text: lines[index].trim().slice(0, 240) });
      if (matches.length <= options.maxMatches) {
        windows.push(clampWindow(
          lineNo - options.before,
          lineNo + options.after,
          lines.length,
          options.maxLines,
        ));
      }
    }
  } else {
    const start = options.start ?? 1;
    const end = options.end ?? Math.min(lines.length, start + options.maxLines - 1);
    windows.push(clampWindow(start, end, lines.length, options.maxLines));
  }

  const merged = mergeWindows(windows, options.maxLines);
  const resultWindows = merged.map((window) => {
    const rendered = windowText(lines, window.start, window.end, options.maxChars);
    return {
      start: window.start,
      end: window.end,
      line_count: window.end - window.start + 1,
      truncated_by_lines: window.truncated,
      truncated_by_chars: rendered.truncated,
      text: rendered.text,
    };
  });

  const result = {
    task: 'safe-read',
    status: resultWindows.length > 0 ? 'read' : 'no_window',
    file: absoluteFile,
    total_lines: lines.length,
    pattern: options.pattern,
    fixed: options.fixed,
    matches_found: matches.length,
    matches: matches.slice(0, options.maxMatches),
    matches_truncated: matches.length > options.maxMatches,
    max_lines_per_window: options.maxLines,
    windows: resultWindows,
  };

  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
}
