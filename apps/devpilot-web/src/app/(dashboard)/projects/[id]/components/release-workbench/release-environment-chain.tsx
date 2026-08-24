/**
 * 环境发布链（串行链路）：预发发布 → 生产发布 →（未来可扩展更多环境发布）。
 * 点击节点切换当前展示的环境发布视图；节点状态图标+文案双通道表达。
 *
 * 结构评审/P2：改为紧凑分段切换器（一行式、内容自适应宽度），
 * 不再渲染两张等宽大摘要卡——环境是范围选择器，不是对比看板
 * （workbench-contract「不要把 staging/production 做成两张大摘要卡」）。
 * PX-16：状态文案按状态着色（完成=绿），与面板内徽章语义同色。
 */
'use client';

import { Fragment, useId, useRef, type KeyboardEvent } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import type { ReleaseChainNode } from '../../utils/project-route.utils';
import { FlowNodeIcon, flowKeyboardTarget } from './release-flow-nav.shared';
import type { ReleaseChainNodeView } from './release-environment-chain.model';

interface Props {
  nodes: ReleaseChainNodeView[];
  selected: ReleaseChainNode;
  onSelect: (node: ReleaseChainNode) => void;
}

export function ReleaseEnvironmentChain(props: Props) {
  const t = useTranslations('projects');
  const baseId = useId();
  const panelId = `${baseId}-chain-panel`;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = flowKeyboardTarget(event.key, index, props.nodes.length);
    if (target === null) return;
    event.preventDefault();
    const node = props.nodes[target];
    if (!node) return;
    props.onSelect(node.key);
    refs.current[target]?.focus();
  };

  return (
    <nav
      className="inline-flex items-center gap-1 rounded-lg border bg-muted/20 p-1 max-[820px]:flex max-[820px]:w-full"
      role="tablist"
      aria-label={t('releaseChainTitle')}
    >
      {props.nodes.map((node, index) => {
        const selected = node.key === props.selected;
        return (
          <Fragment key={node.key}>
            <button
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-${node.key}-tab`}
              tabIndex={selected ? 0 : -1}
              aria-selected={selected}
              aria-controls={panelId}
              data-chain={node.key}
              data-state={node.state}
              className={clsx(
                'flex min-h-9 items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors',
                'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                'max-[820px]:flex-1',
                selected ? 'bg-background ring-1 ring-inset ring-border' : 'bg-transparent',
              )}
              onClick={() => props.onSelect(node.key)}
              onKeyDown={(event) => selectFromKeyboard(event, index)}
            >
              <FlowNodeIcon
                state={node.state}
                size={16}
              />
              <span className="min-w-0 whitespace-nowrap">
                <strong
                  className={clsx(
                    'block truncate text-sm text-foreground',
                    node.state === 'current' && 'text-primary',
                    node.state === 'blocked' && 'text-destructive',
                  )}
                >
                  {t(node.labelKey)}
                </strong>
                <span
                  className={clsx(
                    'block text-[11px]',
                    node.state === 'done' && 'text-emerald-600',
                    node.state === 'blocked' && 'text-destructive',
                    node.state === 'current' && 'text-primary',
                    node.state === 'waiting' && 'text-muted-foreground',
                  )}
                >
                  {t(node.stateLabelKey)}
                </span>
              </span>
            </button>
            {index < props.nodes.length - 1 ? (
              <CaretRight
                aria-hidden="true"
                className="shrink-0 text-border max-[820px]:self-center max-[820px]:rotate-90"
                size={15}
              />
            ) : null}
          </Fragment>
        );
      })}
    </nav>
  );
}
