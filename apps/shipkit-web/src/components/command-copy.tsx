'use client';
import { CopyButton } from './copy-button';

export function CommandCopy({ command }: { command: string }) {
  return <details className="command-details"><summary>查看 AI Agent 命令</summary><div className="command-row"><code>{command}</code><CopyButton text={command} label="复制命令" /></div></details>;
}
