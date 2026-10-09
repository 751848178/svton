'use client';
import { Tooltip } from '@svton/ui';
import { CopyButton } from './copy-button';
import { imageReferenceLabel } from '@/lib/image-reference-label';

export function ImageReference({ value, empty = '尚未部署', prefix }: { value?: string | null; empty?: string; prefix?: string }) {
  if (!value) return <span className="subtle">{empty}</span>;
  return <span className="image-reference">
    {prefix && <span className="image-reference-prefix">{prefix} ·</span>}
    <Tooltip content={<code>{value}</code>} placement="bottom" className="image-reference-tooltip" delay={100}>
      <button type="button" className="image-reference-trigger" aria-label="查看完整镜像引用" onClick={event => { event.stopPropagation(); event.currentTarget.focus(); }}>
        <span className="image-reference-preview mono">{imageReferenceLabel(value)}</span>
      </button>
    </Tooltip>
    <CopyButton key={value} text={value} label="复制镜像引用" iconOnly />
  </span>;
}
