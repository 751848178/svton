/**
 * 环境发布链（串行链路）：预发发布 → 生产发布 →（未来可扩展更多环境发布）。
 * 点击节点切换当前展示的环境发布视图。
 *
 * 复核修 2：改为带方向的长箭头管线——文案在箭头段内，箭头方向表达
 * 「预发 → 生产」的依赖顺序；状态只用底色/图标表达，不再重复状态文字。
 * 无外层卡片包裹（环境是范围选择器，不是卡片看板）。
 *
 * 无障碍：保留 tablist 语义与方向键导航（aria-selected 表达选中，
 * 图标 + 底色 + aria-label 表达状态，不只靠颜色）。
 */
'use client';

import { Fragment, useId, useRef, type KeyboardEvent } from 'react';
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
      className="inline-flex max-w-full items-center"
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
              aria-label={`${t(node.labelKey)} · ${t(node.stateLabelKey)}`}
              aria-controls={panelId}
              data-chain={node.key}
              data-state={node.state}
              className={clsx(
                'flex min-h-8 min-w-0 items-center gap-1.5 py-1.5 pl-4 pr-5 text-left',
                'text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                'max-[820px]:flex-1',
                segmentShape(index === 0),
                segmentTone(node.state, selected),
              )}
              onClick={() => props.onSelect(node.key)}
              onKeyDown={(event) => selectFromKeyboard(event, index)}
            >
              <FlowNodeIcon
                state={node.state}
                size={15}
                tone={selected ? 'inherit' : 'semantic'}
              />
              <span
                className={clsx(
                  'truncate font-medium',
                  node.state !== 'done' && node.state !== 'current' && 'font-normal',
                )}
              >
                {t(node.labelKey)}
              </span>
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}

/** 箭头段形状：首段平头，后续段左侧带燕尾缺口，末端指向右。 */
function segmentShape(isFirst: boolean) {
  return isFirst
    ? 'rounded-l-md [clip-path:polygon(0_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,0_100%)]'
    : 'ml-[2px] rounded-l-md [clip-path:polygon(0_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,0_100%,10px_50%)]';
}

/** 状态底色（选中加深为实底）：完成=绿、进行=蓝、等待=灰、阻断=红。 */
function segmentTone(state: ReleaseChainNodeView['state'], selected: boolean) {
  switch (state) {
    case 'done':
      return selected ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700';
    case 'current':
      return selected ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary';
    case 'blocked':
      return selected ? 'bg-destructive text-white' : 'bg-destructive/10 text-destructive';
    default:
      return selected ? 'bg-muted text-foreground' : 'bg-muted/60 text-muted-foreground';
  }
}
