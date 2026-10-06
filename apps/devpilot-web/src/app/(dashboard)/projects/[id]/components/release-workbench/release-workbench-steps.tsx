/**
 * 预发发布步骤条：完整步骤 [前置检查 → 构建 → 部署]。
 * 点击步骤在步骤条下方内联展示所选步骤的「当前轮次」信息（children 面板）；
 * 步骤条右上角是唯一的「发布」主操作（把最新成功制品部署到预发环境），
 * 支持多轮构建/发布。
 *
 * 复核修 3：改为中线连接的步骤条——图标圆点由一条中线串联，表达先后依赖；
 * 去掉「步骤 0x」序号与状态文字，状态由图标 + 文字颜色表达。
 * 复核修 6：删去「当前步骤：0x」副标（执行位置已由步骤条高亮表达）。
 * 复核修 7：发布禁用原因旁内联「前往部署目标设置」链接（原因 + 出口同处）。
 *
 * PX-18：发布钮禁用原因常驻可见（aria-describedby + 小字），不再只写 title。
 */
'use client';

import { Fragment, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { RocketLaunch } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { PROJECT_COMPACT_ACTION_CLASS } from '../project-workbench-surface';
import { FlowNodeIcon, flowKeyboardTarget } from './release-flow-nav.shared';
import type {
  ReleaseWorkbenchStep,
  ReleaseWorkbenchStepView,
} from './release-workbench-steps.model';

interface Props {
  views: ReleaseWorkbenchStepView[];
  selectedStep: ReleaseWorkbenchStep;
  onSelectStep: (step: ReleaseWorkbenchStep) => void;
  /** 发布（部署当前制品到预发）。 */
  onPublish: () => void;
  publishing: boolean;
  publishDisabled: boolean;
  publishTitle?: string;
  /** 禁用原因可修复时的跳转（如部署目标设置）。 */
  publishRepairHref?: string;
  children: ReactNode;
}

export function ReleaseWorkbenchSteps(props: Props) {
  const t = useTranslations('projects');
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = flowKeyboardTarget(event.key, index, props.views.length);
    if (target === null) return;
    event.preventDefault();
    const view = props.views[target];
    if (!view) return;
    props.onSelectStep(view.key);
    refs.current[target]?.focus();
  };

  return (
    <section
      className="min-w-0"
      aria-labelledby={`${baseId}-title`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2
          id={`${baseId}-title`}
          className="text-sm font-semibold"
        >
          {t('releaseWorkbenchFlowTitle')}
        </h2>
        <div className="flex min-w-0 flex-col items-end">
          <Button
            size="sm"
            loading={props.publishing}
            disabled={props.publishDisabled}
            aria-describedby={
              props.publishDisabled && props.publishTitle
                ? 'workbench-publish-disabled-reason'
                : undefined
            }
            data-testid="workbench-publish-action"
            onClick={props.onPublish}
          >
            <RocketLaunch
              size={15}
              weight="bold"
              aria-hidden="true"
            />
            {t('releaseWorkbenchPublishAction')}
          </Button>
          {props.publishDisabled && props.publishTitle ? (
            <p
              id="workbench-publish-disabled-reason"
              data-testid="workbench-publish-disabled-reason"
              className="mt-1 max-w-[340px] text-right text-xs text-muted-foreground"
              title={props.publishTitle}
            >
              {props.publishTitle}
              {props.publishRepairHref ? (
                <>
                  {'，'}
                  <Link
                    href={props.publishRepairHref}
                    data-testid="workbench-publish-repair-link"
                    className={`${PROJECT_COMPACT_ACTION_CLASS} whitespace-nowrap font-medium text-primary hover:underline`}
                  >
                    {t('releaseWorkbenchOpenTargetSettings')}
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
      <nav
        className="flex min-w-0 items-center"
        role="tablist"
        aria-label={t('releaseOrderExecutionSteps')}
      >
        {props.views.map((view, index) => {
          const selected = view.key === props.selectedStep;
          return (
            <Fragment key={view.key}>
              {index > 0 ? (
                /* 中线连接：左一步已完成时中线走绿色（进度感）。 */
                <span
                  aria-hidden="true"
                  className={clsx(
                    'mx-1 h-px min-w-4 flex-1',
                    props.views[index - 1].state === 'completed' && view.state !== 'blocked'
                      ? 'bg-emerald-300'
                      : 'bg-border',
                  )}
                />
              ) : null}
              <button
                ref={(node) => {
                  refs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`${baseId}-${view.key}-tab`}
                tabIndex={selected ? 0 : -1}
                aria-selected={selected}
                aria-controls={panelId}
                data-step={view.key}
                data-state={view.state}
                className={clsx(
                  'flex shrink-0 items-center gap-2 rounded px-1.5 py-2 text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  stepTone(view.state, selected),
                )}
                onClick={() => props.onSelectStep(view.key)}
                onKeyDown={(event) => selectFromKeyboard(event, index)}
              >
                <FlowNodeIcon state={view.state} />
                <span
                  className={clsx(
                    'whitespace-nowrap',
                    selected &&
                      'font-semibold underline decoration-primary/40 decoration-2 underline-offset-4',
                    view.state === 'waiting' && !selected && 'text-muted-foreground',
                  )}
                >
                  {t(view.labelKey)}
                </span>
              </button>
            </Fragment>
          );
        })}
      </nav>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${baseId}-${props.selectedStep}-tab`}
        className="pt-4"
      >
        {props.children}
      </div>
    </section>
  );
}

/** 步骤文字色：完成=常规前景（图标已表达绿）、进行/选中=主色、阻断=红、等待=灰。 */
function stepTone(state: ReleaseWorkbenchStepView['state'], selected: boolean) {
  if (state === 'blocked') return 'text-destructive';
  if (selected || state === 'current') return 'text-primary';
  if (state === 'completed') return 'text-foreground';
  return 'text-muted-foreground';
}
