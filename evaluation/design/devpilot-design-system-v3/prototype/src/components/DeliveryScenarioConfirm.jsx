import { X } from '@phosphor-icons/react';
import { useDialogFocus } from '../hooks/useDialogFocus.js';
import { Button } from './ui.jsx';

export const deliveryActions = {
  stage: ['部署并验证制品 B', '预发环境将使用制品 B；制品 A 的验证记录继续保留。'],
  start: ['确认生产部署', '制品 B → 生产 3 台主机。演示将在请求创建后模拟响应中断，可核对后继续。'],
  resume: ['继续此次生产运行', '复用 PR-1042 和制品 B；演示回读已确认尚未执行，配置与审批快照匹配。'],
  continue: ['继续剩余 2 台', '首批通过后继续。本情景将模拟第 2 台健康失败并停止第 3 台。'],
  abort: ['中止后续批次', '剩余主机不会部署；已成功主机保持新版本，需要恢复时另建恢复操作。'],
  recover: ['恢复到 1.3.2', '已选择历史稳定版本。演示恢复预览通过；将创建 RV-1043，保留原运行。数据库变更不在恢复范围内。'],
};

export function DeliveryScenarioConfirm({ event, close, confirm }) {
  const ref = useDialogFocus(Boolean(event), close);
  if (!event) return null;
  const [title, description] = deliveryActions[event];
  return <div className="operation-layer dialog-mode" onMouseDown={(e) => e.target === e.currentTarget && close()}>
    <section ref={ref} className="operation-panel operation-dialog" role="dialog" aria-modal="true" aria-labelledby="delivery-confirm-title" aria-describedby="delivery-confirm-description" tabIndex={-1}>
      <header><h2 id="delivery-confirm-title">{title}</h2><button className="icon-button" aria-label="关闭确认" onClick={close}><X size={20} /></button></header>
      <div className="operation-body"><p id="delivery-confirm-description">{description}</p><p>原型模拟操作，不连接实际服务器。</p></div>
      <footer><Button variant="secondary" onClick={close}>取消</Button><Button onClick={confirm}>确认操作</Button></footer>
    </section>
  </div>;
}
