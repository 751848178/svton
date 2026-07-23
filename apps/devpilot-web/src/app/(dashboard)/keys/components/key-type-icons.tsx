/**
 * 密钥类型内联 SVG 图标
 *
 * 单一职责：按密钥类型渲染 lucide 风格的 24x24 描边图标。
 * 不新增依赖：与项目 nav-icons 同方案，内联 path。
 */

import type { JSX } from 'react';
import type { KeyTypeIconName } from '../types';

const ICON_PATHS: Record<KeyTypeIconName, JSX.Element> = {
  shield: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  key: (
    <>
      <circle
        cx="8"
        cy="16"
        r="5"
      />
      <path d="m11.5 12.5 8.5-8.5" />
      <path d="m16 8 2 2" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </>
  ),
  lock: (
    <>
      <rect
        x="3"
        y="11"
        width="18"
        height="11"
        rx="2"
      />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  database: (
    <>
      <ellipse
        cx="12"
        cy="5"
        rx="9"
        ry="3"
      />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </>
  ),
  cog: (
    <>
      <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
      <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m17 20 1-1.7" />
      <path d="m6 5.7 1 1.7" />
      <path d="m2 12 2 0" />
      <path d="m20 12 2 0" />
      <path d="m17 4 1-1.7" />
      <path d="m6 18.3 1-1.7" />
    </>
  ),
};

/** 渲染密钥类型图标。 */
export function KeyTypeIcon({
  name,
  className,
}: {
  name: KeyTypeIconName;
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
      {ICON_PATHS[name]}
    </svg>
  );
}
