import { useState } from 'react';
import { usePrototypeNavigation } from './hooks/usePrototypeNavigation.js';
import { ProjectDirectoryScreen } from './screens/ProjectDirectoryScreen.jsx';
import { AppShell } from './components/AppShell.jsx';
import { ProjectFrame } from './components/ProjectFrame.jsx';
import { ReleaseDetailFrame } from './components/ReleaseDetailFrame.jsx';
import { EvidenceDrawer } from './components/EvidenceDrawer.jsx';
import { ActionLayer } from './components/ActionLayer.jsx';
import { OverviewScreen } from './screens/OverviewScreen.jsx';
import { RepositoryScreen } from './screens/RepositoryScreen.jsx';
import { ConfigurationScreen } from './screens/ConfigurationScreen.jsx';
import { ReleasesScreen } from './screens/ReleasesScreen.jsx';
import { ReleaseScreen } from './screens/ReleaseScreen.jsx';
import { DomainsScreen } from './screens/DomainsScreen.jsx';
import { DeploymentsScreen } from './screens/DeploymentsScreen.jsx';

export function App() {
  const { screen, go: setScreen, overviewTab, setOverviewTab, selectedReleaseId, openRelease } = usePrototypeNavigation();
  const [drawer, setDrawer] = useState(null);
  const [action, setAction] = useState(null);
  const [domainFixed, setDomainFixed] = useState(false);
  const [preflightVerified, setPreflightVerified] = useState(false);
  const [deploymentStarted, setDeploymentStarted] = useState(false);
  const [environment, setEnvironment] = useState('production');
  const [configSection, setConfigSection] = useState('versions');
  const [toast, setToast] = useState('');

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const props = {
    overviewTab, setOverviewTab,
    go: setScreen,
    openRelease,
    openDrawer: setDrawer,
    openAction: (type, payload) => setAction({ type, payload }),
    domainFixed,
    preflightVerified,
    deploymentStarted,
    configSection,
    setConfigSection,
    selectedReleaseId,
    environment,
    setEnvironment,
  };

  const confirmAction = (current) => {
    if (current.type === 'editDomain') {
      setDomainFixed(true);
      setPreflightVerified(false);
      showToast('生产入口草案已保存，发布检查将重新读取服务端状态。');
    } else if (current.type === 'rerunPreflight') {
      setPreflightVerified(true);
      showToast('生产检查已通过：入口、TLS、目标组件与探测均已验证。');
    } else if (current.type === 'startDeployment') {
      setDeploymentStarted(true);
      setScreen('deployments');
      showToast('生产部署已创建，正在复用预发通过的 Manifest。');
    } else if (current.type === 'createRelease') {
      openRelease('R-1042');
      showToast('发布 R-1042 已创建，预发阶段开始执行。');
    } else if (current.type === 'selectEnvironmentVersion' || current.type === 'switchVersion') {
      const environmentLabel = current.payload?.environment === 'staging' ? '预发环境' : '生产环境';
      showToast(`${environmentLabel}切换到 ${current.payload?.version} 的部署操作已创建；成功前仍保持当前版本。`);
    } else {
      showToast('操作请求已记录；界面将在服务端确认后刷新。');
    }
    setAction(null);
  };

  const screens = {
    overview: <OverviewScreen {...props} />,
    repository: <RepositoryScreen {...props} />,
    config: <ConfigurationScreen {...props} />,
    releases: <ReleasesScreen {...props} />,
    release: <ReleaseScreen key={selectedReleaseId} {...props} />,
    domains: <DomainsScreen {...props} />,
    deployments: <DeploymentsScreen {...props} />,
  };

  return (
    <AppShell screen={screen} go={setScreen} openAction={props.openAction}>
      {screen === 'directory' ? <ProjectDirectoryScreen {...props} /> : screen === 'release' ? (
        <ReleaseDetailFrame releaseId={selectedReleaseId} go={setScreen}>
          {screens.release}
        </ReleaseDetailFrame>
      ) : (
        <ProjectFrame screen={screen} go={setScreen} openAction={props.openAction} domainFixed={domainFixed} preflightVerified={preflightVerified}>
          {screens[screen] ?? screens.overview}
        </ProjectFrame>
      )}
      <EvidenceDrawer drawer={drawer} close={() => setDrawer(null)} openAction={props.openAction} />
      <ActionLayer key={action?.type ?? 'none'} action={action} close={() => setAction(null)} confirm={confirmAction} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </AppShell>
  );
}
