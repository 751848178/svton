import { CheckCircle, Circle, Clock, Warning } from '@phosphor-icons/react';

export const stepStateLabels = {
  done: '已完成',
  blocked: '已阻断',
  current: '进行中',
  upcoming: '未开始',
  disabled: '未解锁',
};

export function ReleaseStepStateIcon({ state, size = 18 }) {
  const Icon = state === 'done' ? CheckCircle : state === 'blocked' ? Warning : state === 'current' ? Clock : Circle;
  return <Icon size={size} weight={state === 'upcoming' || state === 'disabled' ? 'regular' : 'fill'} />;
}
