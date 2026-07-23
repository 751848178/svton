/**
 * 域名生成结果区块
 *
 * 单一职责：在共享 CodeBlock 原语之上挂一个区块标题 + 下载入口。
 * 视觉走 token（bg-background / text-foreground），代码体由 CodeBlock 统一渲染。
 */

'use client';

import { useTranslations } from 'next-intl';
import { CodeBlock } from '@/components/ui';

interface CodeBlockSectionProps {
  title: string;
  content: string;
  filename: string;
  onDownload: () => void;
}

export function CodeBlockSection({ title, content, filename, onDownload }: CodeBlockSectionProps) {
  const t = useTranslations('domain');
  return (
    <div className="space-y-2 rounded-lg border bg-background p-6">
      <h2 className="font-semibold text-foreground">{title}</h2>
      <CodeBlock
        content={content}
        filename={filename}
        tone="dark"
        onDownload={onDownload}
        downloadLabel={t('download')}
      />
    </div>
  );
}
