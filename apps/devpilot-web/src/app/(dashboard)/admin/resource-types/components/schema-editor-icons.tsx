/**
 * Schema 编辑器内联 SVG 图标
 *
 * 单一职责：渲染增/上移/下移/删除四个 24x24 描边图标（lucide 风格）。
 * 不新增依赖：与 nav-icons 同方案。
 */

import type { JSX } from 'react';

const PLUS = <path d="M12 5v14M5 12h14" />;
const CHEVRON_UP = <path d="m18 15-6-6-6 6" />;
const CHEVRON_DOWN = <path d="m6 9 6 6 6-6" />;
const X = (
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>
);

const PATHS = {
  plus: PLUS,
  'chevron-up': CHEVRON_UP,
  'chevron-down': CHEVRON_DOWN,
  x: X,
} as const;

export type SchemaEditorIconName = keyof typeof PATHS;

/** 渲染 schema 编辑器图标。 */
export function SchemaEditorIcon({
  name,
  className,
}: {
  name: SchemaEditorIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name] as JSX.Element}
    </svg>
  );
}
