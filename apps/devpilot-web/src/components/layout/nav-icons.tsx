import type { ReactNode } from 'react';
import type { NavIconName } from './navigation-items';

/**
 * 项目内联 SVG 图标方案(lucide 风格,stroke 制,24x24)。
 * 工作区未安装图标库且不新增依赖,故在此维护导航专用图标表。
 */
const iconPaths: Record<NavIconName, ReactNode> = {
  home: (
    <>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M9 22V12h6v10" />
    </>
  ),
  'folder-plus': (
    <>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M12 10v6" />
      <path d="M9 13h6" />
    </>
  ),
  'folder-git': (
    <>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <circle
        cx="9"
        cy="13"
        r="1.6"
      />
      <circle
        cx="15"
        cy="17"
        r="1.6"
      />
      <path d="m10.4 13.8 3.2 2" />
    </>
  ),
  boxes: (
    <>
      <rect
        x="3"
        y="3"
        width="8"
        height="8"
        rx="1"
      />
      <rect
        x="13"
        y="13"
        width="8"
        height="8"
        rx="1"
      />
      <path d="M11 7h4a2 2 0 0 1 2 2v4" />
      <path d="M13 17H9a2 2 0 0 1-2-2v-4" />
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
  gauge: (
    <>
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
      <path d="m12 14 4-4" />
    </>
  ),
  archive: (
    <>
      <rect
        x="2"
        y="3"
        width="20"
        height="5"
        rx="1"
      />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </>
  ),
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  'scroll-text': (
    <>
      <path d="M15 12h-5" />
      <path d="M15 16h-5" />
      <path d="M19 17V5a2 2 0 0 0-2-2H4" />
      <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
    </>
  ),
  'list-checks': (
    <>
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </>
  ),
  'shield-check': (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
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
  network: (
    <>
      <rect
        x="16"
        y="16"
        width="6"
        height="6"
        rx="1"
      />
      <rect
        x="2"
        y="16"
        width="6"
        height="6"
        rx="1"
      />
      <rect
        x="9"
        y="2"
        width="6"
        height="6"
        rx="1"
      />
      <path d="M12 8v4" />
      <path d="M5 16v-2a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2" />
    </>
  ),
  zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  'key-round': (
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
  'file-plus': (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M12 18v-6" />
      <path d="M9 15h6" />
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
  bookmark: <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />,
  'git-branch': (
    <>
      <path d="M6 3v12" />
      <circle
        cx="18"
        cy="6"
        r="3"
      />
      <circle
        cx="6"
        cy="18"
        r="3"
      />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </>
  ),
  'file-search': (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <circle
        cx="11.5"
        cy="14.5"
        r="2.5"
      />
      <path d="m13.3 16.3 2.2 2.2" />
    </>
  ),
  'check-square': (
    <>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
      />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  'shield-alert': (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle
        cx="9"
        cy="7"
        r="4"
      />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  layers: (
    <>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </>
  ),
  tags: (
    <>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8 8a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828z" />
      <circle
        cx="7.5"
        cy="7.5"
        r="1"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  'at-sign': (
    <>
      <circle
        cx="12"
        cy="12"
        r="4"
      />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
    </>
  ),
  cloud: (
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  ),
  'book-open': (
    <>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </>
  ),
};

export function NavIcon({
  name,
  className,
}: {
  name: NavIconName;
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
      {iconPaths[name]}
    </svg>
  );
}
