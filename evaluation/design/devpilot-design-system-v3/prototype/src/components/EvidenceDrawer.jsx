import { ArrowRight, CheckCircle, GitCommit, Robot, ShieldCheck, X } from '@phosphor-icons/react';
import { Button, KeyValue } from './ui.jsx';
import { useDialogFocus } from '../hooks/useDialogFocus.js';

const content = {
  ai: {
    icon: Robot,
    title: '解释生产阻断',
    subtitle: '基于发布 R-1042 的当前检查结果',
    body: 'web 组件没有可被外部访问的生产入口。构建产物和预发验证都已通过，但生产部署后用户仍无法访问应用。',
  },
  manifest: {
    icon: ShieldCheck,
    title: '不可变制品证据',
    subtitle: '预发与生产将复用同一 Manifest',
    body: '该记录由构建服务生成。生产步骤只能引用此已通过预发验证的制品，不会重新构建。',
  },
  commit: {
    icon: GitCommit,
    title: '仓库分析证据',
    subtitle: 'analysis-run-284 · main@a1b2c3d',
    body: '本次分析绑定明确分支与提交。识别到的组件变更需要审核后才会更新项目事实。',
  },
  verified: {
    icon: CheckCircle,
    title: '发布后验证',
    subtitle: '健康检查与入口探测',
    body: '运行结果来自服务端验证记录。界面不会根据部署进度自行推断成功。',
  },
};

export function EvidenceDrawer({ drawer, close, openAction }) {
  const dialogRef = useDialogFocus(Boolean(drawer), close);
  if (!drawer) return null;
  const item = content[drawer] ?? content.manifest;
  const Icon = item.icon;
  return (
    <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <aside ref={dialogRef} className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" aria-describedby="drawer-description" tabIndex={-1}>
        <header>
          <span className="drawer-icon"><Icon size={20} /></span>
          <div><h2 id="drawer-title">{item.title}</h2><p>{item.subtitle}</p></div>
          <button className="icon-button" onClick={close} aria-label="关闭详情"><X size={19} /></button>
        </header>
        <div className="drawer-body">
          <p id="drawer-description" className="drawer-lead">{item.body}</p>
          {drawer === 'ai' ? <AiDetails openAction={openAction} close={close} /> : <EvidenceDetails drawer={drawer} />}
        </div>
      </aside>
    </div>
  );
}

function AiDetails({ openAction, close }) {
  return (
    <>
      <div className="proposal-box">
        <strong>为 web 配置 picshare.acme.dev</strong>
        <span className="proposal-meta">建议路径 · 需要人工确认</span>
        <p>目标为生产环境的 web:3000。保存后重新运行生产检查，Devpilot 才会读取并确认新状态。</p>
      </div>
      <Button onClick={() => { close(); openAction('editDomain'); }}>查看入口配置 <ArrowRight size={16} /></Button>
      <p className="drawer-note">AI 仅解释当前证据并拟定建议，不会直接修改生产配置。</p>
    </>
  );
}

function EvidenceDetails({ drawer }) {
  return (
    <div className="evidence-list">
      <KeyValue label="Manifest" mono>mft_01J6X9P3</KeyValue>
      <KeyValue label="SHA-256" mono>42b8…c19e</KeyValue>
      <KeyValue label="来源提交" mono>a1b2c3d</KeyValue>
      <KeyValue label="验证状态">{drawer === 'verified' ? '检查进行中' : '预发已通过'}</KeyValue>
    </div>
  );
}
