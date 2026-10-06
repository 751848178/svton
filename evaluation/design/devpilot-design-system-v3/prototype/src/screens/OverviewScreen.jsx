import { CaretDown } from '@phosphor-icons/react';
import { components, environmentVersions, projectFacts, releaseRows } from '../view-models.js';
import { EnvironmentVersions } from '../components/ProjectEnvironmentPanel.jsx';
import { ProjectComponentsPanel } from '../components/ProjectComponentsPanel.jsx';
import { ReleasesScreen } from './ReleasesScreen.jsx';

const tabs = [['releases', '发布记录'], ['environments', '环境'], ['components', '组件']];
export function OverviewScreen(props) {
  const { overviewTab: active, setOverviewTab: select, go } = props;
  const counts = { releases: releaseRows.length, environments: Object.keys(environmentVersions).length, components: components.length };
  const keyboard = (event, index) => {
    const offset = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: tabs.length - 1 - index }[event.key];
    if (offset === undefined) return;
    event.preventDefault(); const key = tabs[(index + offset + tabs.length) % tabs.length][0]; select(key); document.getElementById(`overview-${key}`)?.focus();
  };
  const openVersionConfig = (environment) => { props.setEnvironment(environment); props.setConfigSection('versions'); go('config'); };
  return <div className="aligned-overview">
    <section><h2 className="workspace-section-title">基本信息</h2><dl className="aligned-basic-facts">
      {[['项目描述', '—'], ['环境与组件', `${counts.environments} 个环境 · ${counts.components} 个组件`], ['创建人', '—'], ['创建时间', '—'], ['更新时间', '—']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl></section>
    <details className="aligned-repository"><summary>仓库详情 <CaretDown size={16} /></summary><dl className="aligned-basic-facts">{[['仓库地址', projectFacts.repository], ['默认分支', projectFacts.defaultBranch], ['最近分析', projectFacts.latestAnalysis], ['分析时间', projectFacts.latestAnalysisAt]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
    <section className="aligned-content-tabs"><div role="tablist" aria-label="项目内容">{tabs.map(([key, label], index) => <button key={key} id={`overview-${key}`} role="tab" aria-selected={active === key} aria-controls={`panel-${key}`} tabIndex={active === key ? 0 : -1} onKeyDown={(e) => keyboard(e, index)} onClick={() => select(key)}>{label}<span>{counts[key]}</span></button>)}</div>
      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`overview-${active}`} tabIndex={0}>
        {active === 'releases' && <ReleasesScreen {...props} embedded />}
        {active === 'environments' && <EnvironmentVersions openAction={props.openAction} openVersionConfig={openVersionConfig} />}
        {active === 'components' && <ProjectComponentsPanel {...props} />}
      </div>
    </section>
  </div>;
}
