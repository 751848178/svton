export function buildEditDiff(filePath: string, oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  let startIdx = 0;
  while (
    startIdx < oldLines.length &&
    startIdx < newLines.length &&
    oldLines[startIdx] === newLines[startIdx]
  ) {
    startIdx++;
  }

  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (oldEnd > startIdx && newEnd > startIdx && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd--;
    newEnd--;
  }

  const contextLines = 3;
  const ctxStart = Math.max(0, startIdx - contextLines);
  const ctxOldEnd = Math.min(oldLines.length - 1, oldEnd + contextLines);
  const ctxNewEnd = Math.min(newLines.length - 1, newEnd + contextLines);

  const lines: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -${ctxStart + 1},${ctxOldEnd - ctxStart + 1} +${ctxStart + 1},${ctxNewEnd - ctxStart + 1} @@`,
  ];

  for (let i = ctxStart; i <= Math.max(ctxOldEnd, ctxNewEnd); i++) {
    if (i <= ctxOldEnd && i <= ctxNewEnd) {
      if (oldLines[i] === newLines[i]) {
        lines.push(` ${oldLines[i]}`);
      } else {
        lines.push(`-${oldLines[i]}`);
        lines.push(`+${newLines[i]}`);
      }
    } else if (i <= ctxOldEnd) {
      lines.push(`-${oldLines[i]}`);
    } else {
      lines.push(`+${newLines[i]}`);
    }
  }

  return lines.join('\n');
}
