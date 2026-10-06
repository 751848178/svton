import { useEffect, useState } from 'react';

const base = '/projects/P-2048';
const paths = { directory: '/projects', overview: base, config: `${base}/settings`, repository: `${base}/repository-analysis`, deployments: `${base}/deployments`, domains: `${base}/domains` };
function readLocation() {
  const url = new URL(window.location.hash.slice(1) || '/projects', window.location.origin);
  const match = url.pathname.match(/\/releases\/(R-\d+)$/);
  return {
    screen: match ? 'release' : Object.entries(paths).find(([, path]) => path === url.pathname)?.[0] ?? 'directory',
    tab: ['releases', 'environments', 'components'].includes(url.searchParams.get('tab')) ? url.searchParams.get('tab') : 'releases',
    releaseId: match?.[1] ?? 'R-1042',
  };
}
export function usePrototypeNavigation() {
  const [route, setRoute] = useState(readLocation);
  useEffect(() => {
    const changed = () => setRoute(readLocation());
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const navigate = (path) => { window.location.hash = path; setRoute(readLocation()); };
  return {
    screen: route.screen, overviewTab: route.tab, selectedReleaseId: route.releaseId,
    go: (screen) => navigate(screen === 'releases' ? base : screen === 'release' ? `${base}/releases/${route.releaseId}` : paths[screen] ?? '/projects'),
    setOverviewTab: (tab) => navigate(`${base}?tab=${tab}`),
    openRelease: (id) => navigate(`${base}/releases/${id}`),
  };
}
