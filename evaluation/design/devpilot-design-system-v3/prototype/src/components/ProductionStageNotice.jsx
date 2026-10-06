import { ArrowRight, CheckCircle, Robot, Warning } from '@phosphor-icons/react';
import { Button } from './ui.jsx';

export function ProductionStageNotice({ releaseId, domainFixed, preflightVerified, openDrawer, openAction }) {
  const verified = preflightVerified;
  const state = verified ? 'verified' : domainFixed ? 'pending' : 'blocked';
  const title = verified ? '生产检查已通过' : domainFixed ? '生产入口已保存，等待重新检查' : 'web 缺少生产域名入口';
  const description = verified
    ? '入口、TLS、目标组件、探测、审批和并发保护均已由服务端确认，可以开始生产部署。'
    : domainFixed
      ? '服务端重新检查通过前，生产部署仍保持锁定。'
      : '没有入口时，即使生产部署完成，用户仍无法访问；构建产物和预发验证保持有效。';
  const action = verified ? 'startDeployment' : domainFixed ? 'rerunPreflight' : 'editDomain';
  const actionLabel = verified ? '开始生产部署' : domainFixed ? '重新运行生产检查' : '配置生产入口';

  return (
    <section className={`release-stage-notice ${state}`} role="status" aria-label="生产阶段提示">
      <span className="release-stage-notice-icon">{verified ? <CheckCircle size={20} weight="fill" /> : <Warning size={20} weight="fill" />}</span>
      <div><strong>{title}</strong><p>{description}</p><small>发布 {releaseId} · 生产阶段</small></div>
      <div className="release-stage-notice-actions">
        <Button size="sm" onClick={() => openAction(action)}>{actionLabel} <ArrowRight size={15} /></Button>
        {!verified && <button className="text-action" onClick={() => openDrawer('ai')}><Robot size={15} />让 AI 解释</button>}
      </div>
    </section>
  );
}
