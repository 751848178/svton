/**
 * 浏览器端文件下载工具。
 *
 * 单一职责：将文本内容触发为本地文件下载（通过 Blob + 临时 <a>）。
 */

/** 触发浏览器下载文本内容为文件。 */
export function downloadTextFile(content: string, filename: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
