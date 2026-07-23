/**
 * CodeBlock 代码 / 配置展示
 *
 * 统一代码与配置文本的展示块：文件名表头 + 可选下载按钮 + 代码体。
 * tone='dark' 用前景/背景 token（与暗色模式对齐，而非硬编码 gray-900）；
 * tone='muted' 用 muted 背景。替代散落在各页面重复的
 * `bg-gray-900 p-4 text-sm text-gray-100` 代码块。
 *
 * 单一职责：代码文本展示。不做语法高亮、不做业务解析。
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface CodeBlockProps {
  /** 代码 / 配置文本。 */
  content: string;
  /** 文件名（显示在表头）。 */
  filename?: string;
  /** 语言（仅用于表头展示，不做高亮）。 */
  language?: string;
  /** 传入即显示下载按钮。 */
  onDownload?: () => void;
  /**
   * 下载按钮文案。建议传入本地化文案；未传时回退为英文 'Download'。
   */
  downloadLabel?: string;
  /** 视觉色调：dark（前景/背景 token 反相）/ muted。默认 dark。 */
  tone?: 'dark' | 'muted';
  className?: string;
}

/** 统一代码 / 配置展示块。 */
export function CodeBlock(props: CodeBlockProps) {
  const {
    content,
    filename,
    language,
    onDownload,
    downloadLabel,
    tone = 'dark',
    className,
  } = props;

  const bodyClass =
    tone === 'dark'
      ? 'bg-foreground/90 text-background font-mono'
      : 'bg-muted font-mono';

  return (
    <div className={cn('overflow-hidden rounded-md border', className)}>
      {(filename || onDownload) && (
        <div className="flex items-center justify-between gap-2 border-b bg-background/60 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {filename && <span className="font-medium text-foreground">{filename}</span>}
            {language && <span className="uppercase tracking-wide">{language}</span>}
          </div>
          {onDownload && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              {downloadLabel ?? 'Download'}
            </Button>
          )}
        </div>
      )}
      <pre
        className={cn(
          'overflow-x-auto rounded-none p-4 text-sm leading-relaxed',
          bodyClass,
        )}
      >
        {content}
      </pre>
    </div>
  );
}
