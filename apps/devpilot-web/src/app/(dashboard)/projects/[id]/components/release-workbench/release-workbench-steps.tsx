/**
 * 预发发布步骤条：完整步骤 [前置检查 → 构建 → 部署]。
 * 点击步骤在步骤条下方内联展示所选步骤的「当前轮次」信息（children 面板）；
 * 步骤条右上角是唯一的「发布」主操作（把最新成功制品部署到预发环境），
 * 支持多轮构建/发布。
 *
 * PX-15：步骤序号 11px、副标题 12px（原 10px 低于可读下限）。
 * PX-18：发布钮禁用原因常驻可见（aria-describedby + 小字），不再只写 title。
 * PX-28：执行上下文改「当前步骤：03 部署」。
 */
'use client';

import { Fragment, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { CaretRight, RocketLaunch } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
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
  children: ReactNode;
}

export function ReleaseWorkbenchSteps(props: Props) {
  const t = useTranslations('projects');
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const executionStep = props.views.find((view) => view.isCurrent) ?? props.views[0];

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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2
            id={`${baseId}-title`}
            className="text-sm font-semibold"
          >
            {t('releaseWorkbenchFlowTitle')}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('releaseWorkbenchExecutionContext', {
              step: executionStep
                ? `${String(executionStep.number).padStart(2, '0')} ${t(executionStep.labelKey)}`
                : '—',
            })}
          </p>
        </div>
        <div className="flex min-w-0 flex-col items-end">
          <Button
            size="sm"
            loading={props.publishing}
            disabled={props.publishDisabled}
            aria-describedby={
              props.publishDisabled && props.publishTitle ? 'workbench-publish-disabled-reason' : undefined
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
              className="mt-1 max-w-[260px] text-right text-xs text-muted-foreground"
              title={props.publishTitle}
            >
              {props.publishTitle}
            </p>
          ) : null}
        </div>
      </div>
      <nav
        className="flex items-center rounded-lg border bg-muted/20 py-2 max-[820px]:flex-col max-[820px]:items-stretch"
        role="tablist"
        aria-label={t('releaseOrderExecutionSteps')}
      >
        {props.views.map((view, index) => {
          const selected = view.key === props.selectedStep;
          // 状态文案与步骤名相同时不再重复朗读/上屏。
          const stateLabel = t(view.stateLabelKey);
          const showStateLabel = stateLabel !== t(view.labelKey);
          return (
            <Fragment key={view.key}>
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
                  'flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-muted-foreground transition-colors',
                  'hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
                  'max-[820px]:w-full',
                  selected ? 'bg-background ring-1 ring-inset ring-border' : 'bg-transparent',
                )}
                onClick={() => props.onSelectStep(view.key)}
                onKeyDown={(event) => selectFromKeyboard(event, index)}
              >
                <FlowNodeIcon state={view.state} />
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold tracking-[0.06em] text-muted-foreground">
                    {t('releaseStepNumber', { number: String(view.number).padStart(2, '0') })}
                  </span>
                  <strong
                    className={clsx(
                      'mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-foreground',
                      view.isCurrent && view.state !== 'blocked' && 'text-primary',
                      view.state === 'blocked' && 'text-destructive',
                    )}
                  >
                    {t(view.labelKey)}
                  </strong>
                  {showStateLabel ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {stateLabel}
                    </span>
                  ) : null}
                </span>
              </button>
              {index < props.views.length - 1 ? (
                <CaretRight
                  aria-hidden="true"
                  className="shrink-0 text-border max-[820px]:self-center max-[820px]:rotate-90"
                  size={15}
                  weight="regular"
                />
              ) : null}
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
