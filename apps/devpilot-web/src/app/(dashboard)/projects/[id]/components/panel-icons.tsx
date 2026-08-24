/**
 * Panel 字段图标 —— 项目详情页 panel 字段旁的内联 SVG 图标。
 *
 * 单一职责：提供 panel 字段（来源 / 分支 / 环境标识）使用的小尺寸图标。
 *
 * 工作区未安装图标库（与 nav-icons.tsx 同策略），故维护一套 stroke 制、
 * 16x16 视口的 lucide 风格图标，currentColor 取色以便继承 muted-foreground。
 */
import React from 'react';
import type { ReactNode } from 'react';

interface IconProps {
  className?: string;
}

const SVG_ATTRS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const BRANCH_PATH: ReactNode = (
  <>
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </>
);

/** 分支图标 —— 用于 run.branch 字段。 */
export function BranchIcon({ className }: IconProps) {
  return (
    <svg {...SVG_ATTRS} className={className}>
      {BRANCH_PATH}
    </svg>
  );
}

const SOURCE_PATH: ReactNode = (
  <>
    <path d="M12 2v6" />
    <path d="m9 5 3 3 3-3" />
    <path d="M5 12h14" />
    <rect x="3" y="14" width="6" height="7" rx="1" />
    <rect x="15" y="14" width="6" height="7" rx="1" />
  </>
);

/** 来源图标 —— 用于 run.source 字段。 */
export function SourceIcon({ className }: IconProps) {
  return (
    <svg {...SVG_ATTRS} className={className}>
      {SOURCE_PATH}
    </svg>
  );
}

const ENV_KEY_PATH: ReactNode = (
  <>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.5 12.5 9-9" />
    <path d="m16 7 3 3" />
  </>
);

/** 环境标识图标 —— 用于 env.key 字段。 */
export function EnvKeyIcon({ className }: IconProps) {
  return (
    <svg {...SVG_ATTRS} className={className}>
      {ENV_KEY_PATH}
    </svg>
  );
}
