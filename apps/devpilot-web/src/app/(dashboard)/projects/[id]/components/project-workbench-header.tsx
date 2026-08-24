'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, GearSix, GlobeHemisphereWest } from '@phosphor-icons/react';
import { Dropdown } from '@svton/ui';
import { LinkButton } from '@/components/ui';

/**
 * 项目页公共页头（2026-08-23 IA 重构）。
 *
 * 单一职责：页面身份（← 返回 + 项目名）+ 右上角动作区
 * （主操作「创建发布」直达发布工作台；低频配置域收进「配置」下拉）。
 * 不再渲染：项目 icon、仓库地址/默认分支副行（低频参考信息已在项目信息区
 * 与仓库解析区呈现，重复违反"同一事实不进多个视觉容器"）、一级 tabs
 * （发布/配置/域名/部署已迁移为独立页面或跟随发布，见 IA 文档）。
 */
export function ProjectWorkbenchHeader(props: { projectId: string; name: string }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const router = useRouter();
  const [configOpen, setConfigOpen] = useState(false);
  const encodedId = encodeURIComponent(props.projectId);
  const base = `/projects/${encodedId}`;

  const goBack = () => {
    // 常规路径：从项目列表进入 → 返回上一页；深链直达（无历史）时回列表。
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/projects');
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          aria-label={tc('back')}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft
            size={18}
            aria-hidden="true"
          />
        </button>
        <h1 className="truncate text-xl font-semibold">{props.name}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Dropdown
          trigger={
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={configOpen}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <GearSix
                size={15}
                aria-hidden="true"
              />
              {t('workbenchConfigMenu')}
            </button>
          }
          open={configOpen}
          onOpenChange={setConfigOpen}
        >
          <Link
            href={`${base}/settings`}
            onClick={() => setConfigOpen(false)}
            className="flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm hover:bg-accent"
          >
            <GearSix
              size={15}
              aria-hidden="true"
              className="text-muted-foreground"
            />
            {t('workbenchTabConfiguration')}
          </Link>
          <Link
            href={`${base}/domains`}
            onClick={() => setConfigOpen(false)}
            className="flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm hover:bg-accent"
          >
            <GlobeHemisphereWest
              size={15}
              aria-hidden="true"
              className="text-muted-foreground"
            />
            {t('workbenchTabDomains')}
          </Link>
        </Dropdown>
        <LinkButton href={`${base}/releases?create=true`}>{t('createReleaseOrder')}</LinkButton>
      </div>
    </header>
  );
}
