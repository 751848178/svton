import { useState } from 'react';
import { Button, KeyValue, Status } from './ui.jsx';
import { useDeliveryScenario } from '../hooks/useDeliveryScenario.js';
import { deliveryTargets, phaseCopy, scenarios } from './deliveryScenarioModel.js';
import { DeliveryScenarioConfirm, deliveryActions } from './DeliveryScenarioConfirm.jsx';

const actions = { staging: ['stage'], ready: ['start'], resumable: ['resume'], paused: ['continue', 'abort'], failed: ['recover'], aborted: ['recover'] };

export function DeliveryScenarioFlow({ releaseId }) {
  const { state, select, dispatch, reload, storageError } = useDeliveryScenario(releaseId);
  const [confirmation, setConfirmation] = useState(null);
  const [tone, title, description] = phaseCopy[state.phase];
  const phaseIndex = state.phase === 'staging' ? 0 : ['access'].includes(state.phase) ? 2 : ['complete', 'recovered'].includes(state.phase) ? 3 : 1;
  return <section className="delivery-scenarios" aria-label="改进后的发布流程">
    <div className="delivery-demo-toolbar">
      <label>演示情景<select value={state.scenario} onChange={(e) => { select(e.target.value); setConfirmation(null); }}>{Object.entries(scenarios).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <span>规划交互 · 模拟数据 · 本标签页保存</span>
      <Button variant="ghost" onClick={reload}>重新读取记录</Button>
      <Button variant="ghost" onClick={() => select(state.scenario)}>重置情景</Button>
    </div>
    {storageError && <p role="alert">浏览器不允许保存记录，本次演示刷新后可能重置。</p>}
    <ol className="delivery-stage-rail" aria-label="发布阶段">
      {['预发', '生产', '验证', '完成'].map((label, index) => <li key={label} className={state.phase === 'recovered' && index === 1 ? 'failed' : index < phaseIndex ? 'done' : index === phaseIndex ? 'current' : ''} aria-current={index === phaseIndex ? 'step' : undefined}>{label}<small>{state.phase === 'recovered' ? ['已完成', '原运行未成功', '恢复验证通过', '恢复完成'][index] : index < phaseIndex ? '已完成' : index === phaseIndex ? '当前阶段' : '待执行'}</small></li>)}
    </ol>
    <div className="delivery-decision" aria-live="polite">
      <Status value={tone}>{title}</Status><p>{description}</p>
      <div className="delivery-actions">
        {(actions[state.phase] ?? []).map((event, index) => <Button key={event} variant={index ? 'secondary' : 'primary'} onClick={() => setConfirmation(event)}>{deliveryActions[event][0]}</Button>)}
        {state.phase === 'unknown' && <Button onClick={() => dispatch('inspect')}>核对执行状态</Button>}
        {state.phase === 'access' && <Button onClick={() => dispatch('verify')}>重新验证访问入口</Button>}
      </div>
    </div>
    <div className="delivery-facts">
      <KeyValue label="候选制品">{state.candidate}</KeyValue><KeyValue label="预发验证通过">{state.proven}</KeyValue>
      <KeyValue label="生产环境版本">{['paused', 'failed', 'aborted'].includes(state.phase) ? '目标版本不一致' : state.current}</KeyValue><KeyValue label="本次生产运行">{state.run ?? '尚未创建'}</KeyValue>
    </div>
    <section className="delivery-targets"><h3>部署目标</h3>
      <table><caption className="sr-only">各主机实际版本与执行结果（模拟）</caption><thead><tr><th>目标</th><th>运行版本</th><th>结果</th></tr></thead>
        <tbody>{deliveryTargets(state).map(([name, version, result]) => <tr key={name}><th scope="row">{name}</th><td>{version}</td><td>{result}</td></tr>)}</tbody>
      </table>
    </section>
    <details className="delivery-evidence"><summary>查看执行与版本记录（{state.events.length} 条事件）</summary>
      <ol>{state.events.map((event, index) => <li key={index}>{event}</li>)}</ol>
      <h4>历史版本</h4><ul>{state.history.map((version) => <li key={version}>{version}</li>)}</ul>
    </details>
    <DeliveryScenarioConfirm event={confirmation} close={() => setConfirmation(null)} confirm={() => { dispatch(confirmation); setConfirmation(null); }} />
  </section>;
}
