/**
 * 项目详情页 - 头部信息条
 *
 * 单一职责：渲染返回按钮 + 项目名 + 整体健康度 StatusTag +
 * 元信息（git 仓库 / 创建时间 / 应用数 / 环境数）+ 突出的「部署」主操作按钮。
 *
 * 遵循 teams/[id] 的头部骨架（图标返回按钮 + 标题），并叠加
 * 健康度徽章与主 CTA，给出页面的第一焦点（"项目状态如何"）。
 * 不承载任何业务逻辑 —— 所有数据来自传入的 detail，派生通过纯函数。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Tag } from '@svton/ui';
import { Button, StatusTag } from '@/components/ui';
import { formatDateTime } from '@/lib/format-date';
import type { useProjectDetail } from '../hooks/use-project-detail';
import {
  getProjectHealth,
  getHealthLabelKey,
  getHealthStatusValue,
} from '../utils/project-health';

type DetailHook = ReturnType<typeof useProjectDetail>;

interface ProjectDetailHeaderProps {
  detail: DetailHook;
  /** 点击「部署」主按钮时的回调（由 page 传入，负责切换到部署 tab）。 */
  onDeployClick?: () => void;
}

export function ProjectDetailHeader({ detail, onDeployClick }: ProjectDetailHeaderProps) {
  const t = useTranslations('projects');
  const p = detail.project;
  if (!p) return null;

  const health = getProjectHealth({ runs: detail.deploymentRuns, project: p });
  const appCount = p.applications?.length ?? 0;
  const envCount = p.environments?.length ?? 0;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('backToProjects')}
            onClick={() => {
              if (typeof window !== 'undefined') window.history.back();
            }}
          >
            <BackArrowIcon />
          </Button>
          <h1 className="text-2xl font-bold">{p.name}</h1>
          <StatusTag
            status={getHealthStatusValue(health)}
            label={t(getHealthLabelKey(health))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-1 text-sm text-muted-foreground">
          {p.gitRepo ? (
            <span className="break-all font-mono text-xs">{p.gitRepo}</span>
          ) : (
            <span className="text-xs">{t('notLinked')}</span>
          )}
          <Dot />
          <span>
            {t('createdAtLabel')}: {formatDateTime(p.createdAt)}
          </span>
          <Dot />
          <Tag color="blue">
            {t('appCount', { count: appCount })}
          </Tag>
          <Tag color="cyan">
            {t('envCount', { count: envCount })}
          </Tag>
        </div>
      </div>
      <Button variant="primary" onClick={onDeployClick}>
        {t('deployAction')}
      </Button>
    </div>
  );
}

/** 间隔圆点。 */
function Dot() {
  return <span className="text-muted-foreground/50" aria-hidden="true">·</span>;
}

/** 内联回退箭头（与 teams/[id] 风格一致）。 */
function BackArrowIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}
