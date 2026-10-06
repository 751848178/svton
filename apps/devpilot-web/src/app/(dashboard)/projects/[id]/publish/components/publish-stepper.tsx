/**
 * 发布向导步骤条（第 0 步）
 *
 * 单一职责：展示向导三步（选环境 → 确认配置 → 确认发布）的当前与完成态。
 * 复核修 3：与发布详情步骤条同一视觉语言——中线连接、图标+名称，
 * 状态由图标/颜色表达；不再渲染三张步骤卡片与「第 N 步」序号文字。
 */

import { CheckCircle, Circle, CircleNotch } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';

const STEPS = ['publishStepEnvironment', 'publishStepConfig', 'publishStepConfirm'] as const;

export function PublishStepper({ step }: { step: number }) {
  const t = useTranslations('projects');
  return (
    <nav
      className="flex min-w-0 items-center"
      aria-label={t('publishSteps')}
    >
      {STEPS.map((label, index) => {
        const number = index + 1;
        const current = number === step;
        const completed = number < step;
        return (
          <span
            key={label}
            className="contents"
          >
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={clsx(
                  'mx-1 h-px min-w-4 flex-1',
                  completed ? 'bg-emerald-300' : 'bg-border',
                )}
              />
            ) : null}
            <span
              aria-current={current ? 'step' : undefined}
              className="flex shrink-0 items-center gap-2 py-2 text-sm"
            >
              <span
                className={clsx(
                  'shrink-0',
                  completed && 'text-emerald-600',
                  current && 'text-primary',
                  !completed && !current && 'text-muted-foreground',
                )}
              >
                {completed ? (
                  <CheckCircle
                    size={18}
                    weight="fill"
                    aria-hidden="true"
                  />
                ) : current ? (
                  <CircleNotch
                    size={18}
                    weight="bold"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    size={18}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span
                className={clsx(
                  'whitespace-nowrap',
                  current && 'font-semibold text-primary',
                  completed && 'font-medium',
                  !completed && !current && 'text-muted-foreground',
                )}
              >
                {t(label)}
              </span>
            </span>
          </span>
        );
      })}
    </nav>
  );
}
