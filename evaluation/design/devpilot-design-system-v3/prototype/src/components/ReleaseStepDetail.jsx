import { ArrowRight } from '@phosphor-icons/react';
import { DataTable } from './DataTable.jsx';
import { ReleaseStepStateIcon, stepStateLabels } from './ReleaseStepState.jsx';
import { Status } from './ui.jsx';

const checkLabels = { success: '通过', warning: '待确认', blocked: '阻断' };

export function ReleaseStepDetail({ stageKey, step, openDrawer }) {
  return (
    <section
      id={`release-substep-panel-${stageKey}-${step.key}`}
      className={`release-step-detail ${step.state}`}
      role="tabpanel"
      aria-labelledby={`release-substep-tab-${stageKey}-${step.key}`}
      tabIndex={0}
    >
      <header>
        <div>
          <h4>{step.label}详情</h4>
          <p>{step.description}</p>
        </div>
        <span className="release-step-state"><ReleaseStepStateIcon state={step.state} />{stepStateLabels[step.state]}</span>
      </header>

      {step.resources && (
        <DataTable columns={['资源', '来源', '类型', '结果']} className="release-resource-table" wrapperClassName="release-step-table" label="构建资源">
          {step.resources.map((resource) => (
            <tr key={resource.name}><td><strong>{resource.name}</strong></td><td>{resource.path}</td><td>{resource.runtime}</td><td>{resource.result}</td></tr>
          ))}
        </DataTable>
      )}

      {step.checks?.length > 0 && <div className="release-step-checks"><h5>步骤检查与治理</h5><DataTable columns={['检查', '结果', '状态', '操作']} className="release-check-table" label={`${step.label}检查与治理`}>
        {step.checks.map((item) => <tr key={item.label}><td><strong>{item.label}</strong></td><td>{item.detail}</td><td><Status value={item.status}>{checkLabels[item.status]}</Status></td><td>{item.evidence ? <button className="table-action" onClick={() => openDrawer(item.evidence)}>查看证据</button> : '—'}</td></tr>)}
      </DataTable></div>}

      <dl className="release-step-facts">
        {step.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>

      {step.evidence && <button className="text-action" onClick={() => openDrawer(step.evidence)}>查看步骤证据 <ArrowRight size={15} /></button>}
    </section>
  );
}
