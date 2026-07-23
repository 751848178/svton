/**
 * 资源池类型内联 SVG 图标
 *
 * 单一职责：按资源池类型渲染 lucide 风格 24x24 描边图标。
 * 不新增依赖：与 nav-icons 同方案。
 */

import type { JSX } from 'react';
import type { PoolTypeIconName } from '../types';

const ICON_PATHS: Record<PoolTypeIconName, JSX.Element> = {
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
  server: (
    <>
      <rect
        x="2"
        y="2"
        width="20"
        height="8"
        rx="2"
      />
      <rect
        x="2"
        y="14"
        width="20"
        height="8"
        rx="2"
      />
      <path d="M6 6h.01" />
      <path d="M6 18h.01" />
    </>
  ),
  globe: (
    <>
      <circle
        cx="12"
        cy="12"
        r="10"
      />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </>
  ),
  cloud: <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />,
};

/** 渲染资源池类型图标。 */
export function PoolTypeIcon({
  name,
  className,
}: {
  name: PoolTypeIconName;
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
