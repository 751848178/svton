/**
 * 域名配置工具函数
 *
 * 单一职责：纯函数（文件下载）。
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
