import type { Plan } from './contracts';

export interface ReviewService { serviceKey: string; selected: boolean; action: string; detail: string; imageRef?: string }

export function releaseReviewSource(plan: Plan): string {
  return plan.sourceMode === 'directory' ? '本机目录快照' : plan.sourceMode === 'git' ? 'Git 已提交版本' : '原计划未记录源码来源';
}

export function releaseReviewServices(plan: Plan): ReviewService[] {
  if (plan.kind === 'rollback') return plan.selection.map(serviceKey => ({
    serviceKey, selected: true, action: '恢复到目标快照',
    detail: plan.detail.history?.restoreServices?.[serviceKey]?.imageRef || '原计划未记录目标镜像',
    imageRef: plan.detail.history?.restoreServices?.[serviceKey]?.imageRef,
  }));
  const services = plan.detail.releasePlan?.services;
  const keys = [...new Set([...Object.keys(services || {}), ...plan.selection])];
  return keys.map(serviceKey => {
    const selected = plan.selection.includes(serviceKey);
    const service = services?.[serviceKey];
    const platform = service?.platform || plan.detail.releasePlan?.constraints.platform;
    return {
      serviceKey, selected, action: selected ? '构建并更新' : '继承基线版本',
      detail: selected ? [service?.dockerfile, platform].filter(Boolean).join(' · ') || '原计划未记录构建配置'
        : service?.imageRef || '原计划未记录继承镜像',
      imageRef: selected ? undefined : service?.imageRef,
    };
  });
}
