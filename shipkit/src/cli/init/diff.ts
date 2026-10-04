// Minimal line-based unified diff for small config files (LCS on lines, 3 lines of context).

export function unifiedDiff(before: string, after: string, beforeLabel: string, afterLabel: string): string {
  const a = before.split('\n');
  const b = after.split('\n');
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i..] and b[j..]; inputs are tiny config files
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ops: { kind: ' ' | '-' | '+'; line: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: ' ', line: a[i]! });
      i++; j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ kind: '-', line: a[i]! });
      i++;
    } else {
      ops.push({ kind: '+', line: b[j]! });
      j++;
    }
  }
  while (i < n) ops.push({ kind: '-', line: a[i++]! });
  while (j < m) ops.push({ kind: '+', line: b[j++]! });

  // collapse long runs of unchanged lines to context windows
  const out: string[] = [`--- ${beforeLabel}`, `+++ ${afterLabel}`];
  const CONTEXT = 3;
  let k = 0;
  while (k < ops.length) {
    if (ops[k]!.kind === ' ') {
      k++;
      continue;
    }
    const start = Math.max(0, k - CONTEXT);
    let end = k;
    while (end < ops.length) {
      const ahead = ops.slice(end, end + CONTEXT + 1);
      if (ahead.every((op) => op.kind === ' ') && ahead.length === CONTEXT + 1) break;
      end++;
    }
    if (out.length > 2) out.push('  ⋯');
    for (const op of ops.slice(start, end)) out.push(`${op.kind} ${op.line}`);
    k = end;
  }
  return out.length === 2 ? '' : out.join('\n');
}
