import type { Plan } from './contracts';

export interface ReviewService { serviceKey: string; selected: boolean; action: string; detail: string; imageRef?: string }

export function releaseReviewSource(plan: Plan): string {
  if (plan.kind === 'config-only') return '沿用各服务当前镜像及原源码，不解析最新 Git';
  if (plan.detail?.sourceSnapshot) return `${plan.detail.sourceSnapshot.requestedRef.kind} · ${plan.detail.sourceSnapshot.requestedRef.value}`;
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
      serviceKey, selected, action: selected ? plan.kind === 'config-only' ? '复用镜像，更新运行配置' : '构建并更新' : '继承基线版本',
      detail: selected && plan.kind !== 'config-only' ? [service?.dockerfile, platform].filter(Boolean).join(' · ') || '原计划未记录构建配置'
        : service?.imageRef || '原计划未记录继承镜像',
      imageRef: selected && plan.kind !== 'config-only' ? undefined : service?.imageRef,
    };
  });
}
